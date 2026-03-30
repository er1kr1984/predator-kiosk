#!/usr/bin/env python3
"""Deploy predator-kiosk to any server over SSH.

Usage:
    python deploy.py <host> <user>
    python deploy.py 192.168.1.10 erikr

The script will prompt for the SSH password.
"""
import paramiko
import os
import sys
import getpass
import time

REMOTE_DIR = '/opt/predator-kiosk'
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

SKIP_DIRS = {'node_modules', '.claude', 'dist', '.git', '__pycache__'}

NGINX_CONF = """\
server {{
    listen 80;
    return 301 https://$host$request_uri;
}}

server {{
    listen 443 ssl;

    ssl_certificate     /etc/ssl/predator-kiosk/cert.pem;
    ssl_certificate_key /etc/ssl/predator-kiosk/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Increase timeouts for large file uploads / camera snapshots
    proxy_read_timeout  60s;
    client_max_body_size 20M;

    location / {{
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }}
}}
"""


def connect(host, user, password):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=15)
    return client


def run(client, cmd, timeout=120):
    print(f'  $ {cmd[:120]}')
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        for line in out.split('\n'):
            print(f'    {line}')
    if err and 'warning' not in err.lower() and 'deprecat' not in err.lower():
        for line in err.split('\n')[-3:]:
            if line.strip():
                print(f'    ERR: {line}')
    return out


def sudo(client, password, cmd, timeout=300):
    return run(client, f'echo "{password}" | sudo -S {cmd} 2>&1', timeout=timeout)


def upload_dir(sftp, local_path, remote_path, skip_names=None):
    if skip_names is None:
        skip_names = set()
    try:
        sftp.mkdir(remote_path)
    except Exception:
        pass
    for item in os.listdir(local_path):
        if item in skip_names:
            continue
        lp = os.path.join(local_path, item)
        rp = remote_path + '/' + item
        if os.path.isdir(lp):
            upload_dir(sftp, lp, rp, skip_names)
        else:
            try:
                sftp.put(lp, rp)
                print(f'  uploaded: {item}')
            except Exception as e:
                print(f'  SKIP {item}: {e}')


def main():
    if len(sys.argv) < 3:
        print('Usage: python deploy.py <host> <user>')
        print('Example: python deploy.py 192.168.1.10 erikr')
        sys.exit(1)

    host = sys.argv[1]
    user = sys.argv[2]
    password = getpass.getpass(f'SSH password for {user}@{host}: ')

    print(f'=== Connecting to {host} ===')
    client = connect(host, user, password)
    sftp = client.open_sftp()

    # ── Node.js ────────────────────────────────────────────────────────────────
    print('\n=== Checking Node.js ===')
    node_ver = run(client, 'node --version 2>/dev/null || echo OLD')
    if not any(node_ver.startswith(f'v{v}') for v in ('18', '20', '22')):
        print('  Installing Node.js 20 LTS...')
        sudo(client, password, 'bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"', timeout=120)
        sudo(client, password, 'apt-get install -y nodejs', timeout=180)
    run(client, 'node --version && npm --version')

    # ── App directory ──────────────────────────────────────────────────────────
    print('\n=== Creating app directory ===')
    sudo(client, password, f'mkdir -p {REMOTE_DIR}')
    sudo(client, password, f'chown {user}:{user} {REMOTE_DIR}')

    # ── Upload ─────────────────────────────────────────────────────────────────
    print('\n=== Uploading project files ===')
    upload_dir(sftp, os.path.join(LOCAL_DIR, 'backend'),  f'{REMOTE_DIR}/backend',  SKIP_DIRS)
    upload_dir(sftp, os.path.join(LOCAL_DIR, 'frontend'), f'{REMOTE_DIR}/frontend', SKIP_DIRS)

    # ── Install & build ────────────────────────────────────────────────────────
    print('\n=== Installing backend dependencies ===')
    run(client, f'cd {REMOTE_DIR}/backend && npm install --omit=dev 2>&1 | tail -5', timeout=120)

    print('\n=== Installing frontend dependencies & building ===')
    run(client, f'cd {REMOTE_DIR}/frontend && npm install 2>&1 | tail -5', timeout=120)
    run(client, f'cd {REMOTE_DIR}/frontend && npm run build 2>&1 | tail -10', timeout=120)

    # ── PM2 ────────────────────────────────────────────────────────────────────
    print('\n=== Installing PM2 ===')
    sudo(client, password, 'npm install -g pm2 2>&1 | tail -3', timeout=120)

    print('\n=== Starting app with PM2 ===')
    run(client, f'pm2 stop predator-kiosk 2>/dev/null; pm2 delete predator-kiosk 2>/dev/null; true')
    run(client, f'cd {REMOTE_DIR}/backend && NODE_ENV=production pm2 start server.js --name predator-kiosk')
    run(client, 'pm2 save')
    startup_cmd = run(client, f'pm2 startup systemd -u {user} --hp /home/{user} 2>&1 | grep "sudo"')
    if startup_cmd:
        sudo(client, password, startup_cmd.replace('sudo ', ''))

    # ── nginx + HTTPS ──────────────────────────────────────────────────────────
    print('\n=== Installing nginx ===')
    sudo(client, password, 'apt-get install -y nginx 2>&1 | tail -5', timeout=120)

    print('\n=== Generating self-signed SSL certificate ===')
    sudo(client, password, 'mkdir -p /etc/ssl/predator-kiosk')
    sudo(client, password, (
        'openssl req -x509 -nodes -days 3650 -newkey rsa:2048 '
        '-keyout /etc/ssl/predator-kiosk/key.pem '
        '-out /etc/ssl/predator-kiosk/cert.pem '
        f'-subj "/CN={host}/O=E2E Storeroom Kiosk" 2>&1'
    ))

    print('\n=== Writing nginx config ===')
    conf_content = NGINX_CONF.format()
    # Write config via heredoc
    escaped = conf_content.replace("'", "'\\''")
    sudo(client, password, f"bash -c 'cat > /etc/nginx/sites-available/predator-kiosk << \\'NGINXEOF\\'\n{escaped}\nNGINXEOF'")
    sudo(client, password, 'ln -sf /etc/nginx/sites-available/predator-kiosk /etc/nginx/sites-enabled/predator-kiosk')
    sudo(client, password, 'rm -f /etc/nginx/sites-enabled/default')
    sudo(client, password, 'nginx -t && systemctl restart nginx')

    # ── Firewall ───────────────────────────────────────────────────────────────
    print('\n=== Firewall: allow 80 & 443, restrict 3001 to localhost ===')
    sudo(client, password, 'ufw allow 80/tcp 2>/dev/null || true')
    sudo(client, password, 'ufw allow 443/tcp 2>/dev/null || true')
    sudo(client, password, 'ufw deny 3001/tcp 2>/dev/null || true')

    # ── Verify ─────────────────────────────────────────────────────────────────
    print('\n=== Verifying deployment ===')
    time.sleep(2)
    run(client, 'pm2 list')
    run(client, 'curl -sk https://localhost | head -c 200 || echo "No response yet"')

    sftp.close()
    client.close()
    print(f'\n=== Deployment complete ===')
    print(f'  App URL: https://{host}')
    print(f'  Note:    Self-signed cert — browser will show a security warning.')
    print(f'           Install the cert from /etc/ssl/predator-kiosk/cert.pem')
    print(f'           into your trusted roots to remove the warning.')
    print(f'  Manage:  pm2 logs predator-kiosk')
    print(f'  Restart: pm2 restart predator-kiosk')


if __name__ == '__main__':
    main()
