#!/usr/bin/env python3
"""Deploy predator-kiosk to production server"""
import paramiko
import os
import time

HOST = '172.25.192.27'
USER = 'erikr'
PASS = 'Sw3d3n1984'
REMOTE_DIR = '/opt/predator-kiosk'
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

SKIP_DIRS = {'node_modules', '.claude', 'dist', '.git', '__pycache__'}

def connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    return client

def run(client, cmd, timeout=120):
    print(f'  $ {cmd[:100]}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
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

def sudo(client, cmd, timeout=300):
    """Run sudo command by piping password"""
    return run(client, f'echo "{PASS}" | sudo -S {cmd} 2>&1', timeout=timeout)

def upload_dir(sftp, local_path, remote_path, skip_names=None):
    if skip_names is None:
        skip_names = set()
    try:
        sftp.mkdir(remote_path)
    except:
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
    print('=== Connecting to server ===')
    client = connect()
    sftp = client.open_sftp()

    print('\n=== Installing Node.js 20 LTS ===')
    node_ver = run(client, 'node --version 2>/dev/null || echo OLD')
    if not node_ver.startswith('v20') and not node_ver.startswith('v18') and not node_ver.startswith('v22'):
        print('  Upgrading Node.js...')
        sudo(client, 'bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"', timeout=120)
        sudo(client, 'apt-get install -y nodejs', timeout=180)
    run(client, 'node --version && npm --version')

    print('\n=== Creating app directory ===')
    sudo(client, f'mkdir -p {REMOTE_DIR}')
    sudo(client, f'chown {USER}:{USER} {REMOTE_DIR}')

    print('\n=== Uploading project files ===')
    upload_dir(sftp, os.path.join(LOCAL_DIR, 'backend'), f'{REMOTE_DIR}/backend', SKIP_DIRS)
    upload_dir(sftp, os.path.join(LOCAL_DIR, 'frontend'), f'{REMOTE_DIR}/frontend', SKIP_DIRS)

    print('\n=== Installing backend dependencies ===')
    run(client, f'cd {REMOTE_DIR}/backend && npm install --omit=dev 2>&1 | tail -5', timeout=120)

    print('\n=== Installing frontend dependencies & building ===')
    run(client, f'cd {REMOTE_DIR}/frontend && npm install 2>&1 | tail -5', timeout=120)
    run(client, f'cd {REMOTE_DIR}/frontend && npm run build 2>&1 | tail -10', timeout=120)

    print('\n=== Installing PM2 ===')
    sudo(client, 'npm install -g pm2 2>&1 | tail -3', timeout=120)

    print('\n=== Starting app with PM2 ===')
    run(client, f'pm2 stop predator-kiosk 2>/dev/null; pm2 delete predator-kiosk 2>/dev/null; true')
    run(client, f'cd {REMOTE_DIR}/backend && PORT=3001 pm2 start server.js --name predator-kiosk')
    run(client, 'pm2 save')
    # Enable PM2 to start on boot
    startup_cmd = run(client, f'pm2 startup systemd -u {USER} --hp /home/{USER} 2>&1 | grep "sudo"')
    if startup_cmd:
        sudo(client, startup_cmd.replace('sudo ', ''))

    print('\n=== Firewall: allow port 3001 ===')
    sudo(client, 'ufw allow 3001/tcp 2>/dev/null || true')

    print('\n=== Verifying deployment ===')
    time.sleep(2)
    run(client, 'pm2 list')
    run(client, 'curl -s http://localhost:3001 | head -c 200 || echo "No response yet"')

    sftp.close()
    client.close()
    print(f'\n=== Deployment complete ===')
    print(f'  App URL: http://{HOST}:3001')
    print(f'  Manage:  pm2 logs predator-kiosk')
    print(f'  Restart: pm2 restart predator-kiosk')

if __name__ == '__main__':
    main()
