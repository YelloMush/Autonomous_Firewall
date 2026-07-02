import boto3

def provision_aegis_queue():
    # Initialize the SQS client targeting the Mumbai region
    sqs = boto3.client('sqs', region_name='ap-south-1')
    queue_name = 'Aegis-Ingestion-Queue'

    try:
        print(f"[*] Provisioning {queue_name}...")
        response = sqs.create_queue(
            QueueName=queue_name,
            Attributes={
                'DelaySeconds': '0',
                'MessageRetentionPeriod': '3600', # Keep packets for 1 hour max
                'ReceiveMessageWaitTimeSeconds': '5', # Enable Long Polling
                'VisibilityTimeout': '30'
            }
        )
        queue_url = response['QueueUrl']
        print(f"[+] SUCCESS: Queue deployed at {queue_url}")
        
        # Save this URL; your sniffer node and ML brain will need it to communicate
        with open("aegis_config.txt", "w") as f:
            f.write(f"SQS_QUEUE_URL={queue_url}")
            
    except Exception as e:
        print(f"[!] Deployment failed: {e}")

if __name__ == "__main__":
    provision_aegis_queue()