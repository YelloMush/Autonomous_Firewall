import boto3
import os
import stat
import subprocess
import sys

def get_config(filepath):
    config = {}
    lines = []
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            lines = f.readlines()
            for line in lines:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    config[k] = v
    return config, lines

def write_config(filepath, lines, new_ip):
    replaced = False
    new_lines = []
    for line in lines:
        if line.startswith("SENSOR_PUBLIC_IP="):
            new_lines.append(f"SENSOR_PUBLIC_IP={new_ip}\n")
            replaced = True
        else:
            new_lines.append(line)
            
    if not replaced:
        # Add a newline if the last line doesn't have one
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines[-1] += '\n'
        new_lines.append(f"SENSOR_PUBLIC_IP={new_ip}\n")
        
    with open(filepath, "w") as f:
        f.writelines(new_lines)

def main():
    region = 'ap-south-1'
    ec2 = boto3.client('ec2', region_name=region)
    ssm = boto3.client('ssm', region_name=region)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "aegis_config.txt")
    key_file = os.path.join(script_dir, "aegis_edge_key.pem")
    key_name = 'aegis_edge_key'
    
    # 1. Read config to get subnet
    config, lines = get_config(config_path)
    subnet_id = config.get("SUBNET_ID")
    if not subnet_id:
        print("[-] SUBNET_ID not found in config.")
        return

    # Terminate existing instance(s) using the key pair
    print("[*] Finding existing instances to terminate...")
    # Also check if SENSOR_PUBLIC_IP was in config to terminate it by IP if needed,
    # but querying by key name is reliable for the sensor.
    response = ec2.describe_instances(
        Filters=[
            {'Name': 'key-name', 'Values': [key_name]},
            {'Name': 'instance-state-name', 'Values': ['running', 'pending', 'stopped', 'stopping']}
        ]
    )
    instances_to_terminate = []
    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            instances_to_terminate.append(instance['InstanceId'])
            
    if instances_to_terminate:
        print(f"[*] Terminating instances: {instances_to_terminate}")
        ec2.terminate_instances(InstanceIds=instances_to_terminate)
        
        # Wait for termination to free up resources
        waiter = ec2.get_waiter('instance_terminated')
        waiter.wait(InstanceIds=instances_to_terminate)
        print("[+] Instances terminated.")
    else:
        print("[*] No existing instances found to terminate.")

    # 2. Delete existing key pair
    print(f"[*] Deleting key pair '{key_name}'...")
    try:
        ec2.delete_key_pair(KeyName=key_name)
        print("[+] Key pair deleted.")
    except Exception as e:
        print(f"[-] Error deleting key pair: {e}")

    # 3. Create new key pair
    print(f"[*] Creating new key pair '{key_name}'...")
    key_response = ec2.create_key_pair(KeyName=key_name)
    key_material = key_response['KeyMaterial']
    
    # 4. Save private key — force-delete the old locked file, then write fresh
    if os.path.exists(key_file):
        # PowerShell's Remove-Item -Force bypasses all Windows ACL locks
        result = subprocess.run(
            ["powershell", "-Command", f"Remove-Item -Force '{key_file}'"],
            capture_output=True, text=True
        )
        if os.path.exists(key_file):
            print(f"[-] Could not remove old key file: {result.stderr.strip()}")

    with open(key_file, "w") as f:
        f.write(key_material)

    # Lock it down: strip inheritance, grant full control to current user only.
    # (F) = Full Control satisfies OpenSSH (no BUILTIN\Users access) AND allows future deletion.
    user = os.environ.get("USERNAME", "HP")
    try:
        subprocess.run(["icacls.exe", key_file, "/inheritance:r"], check=True, capture_output=True)
        subprocess.run(["icacls.exe", key_file, "/grant:r", f"{user}:(F)"], check=True, capture_output=True)
        print(f"[+] Key saved to {key_file} with restricted permissions.")
    except Exception as e:
        print(f"[!] Could not set key permissions: {e} — continuing anyway.")

    # 5. Get AL2023 AMI
    print("[*] Finding Amazon Linux 2023 AMI...")
    ami_response = ssm.get_parameter(
        Name='/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64'
    )
    ami_id = ami_response['Parameter']['Value']
    print(f"[+] Found AL2023 AMI: {ami_id}")

    # Launch instance
    print(f"[*] Launching new EC2 instance in Subnet {subnet_id}...")
    run_response = ec2.run_instances(
        ImageId=ami_id,
        InstanceType='t3.micro',
        KeyName=key_name,
        MinCount=1,
        MaxCount=1,
        NetworkInterfaces=[{
            'DeviceIndex': 0,
            'SubnetId': subnet_id,
            'AssociatePublicIpAddress': True
        }],
        TagSpecifications=[{
            'ResourceType': 'instance',
            'Tags': [{'Key': 'Name', 'Value': 'Aegis-Edge-Sensor'}]
        }]
    )
    instance_id = run_response['Instances'][0]['InstanceId']
    print(f"[*] Created instance: {instance_id}")

    # 6. Wait for running state
    print("[*] Waiting for instance to enter 'running' state (this may take a minute)...")
    waiter = ec2.get_waiter('instance_running')
    waiter.wait(InstanceIds=[instance_id])
    print("[+] Instance is running.")

    # Get public IP
    desc_response = ec2.describe_instances(InstanceIds=[instance_id])
    public_ip = desc_response['Reservations'][0]['Instances'][0].get('PublicIpAddress')
    
    if public_ip:
        print(f"[+] New Public IP: {public_ip}")
        # 7. Overwrite config
        write_config(config_path, lines, public_ip)
        print("[+] aegis_config.txt updated.")
    else:
        print("[-] Failed to get Public IP.")

if __name__ == "__main__":
    main()
