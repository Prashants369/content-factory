import os
import json
import redis
import requests
from rq import Worker, Queue, Connection

# Setup Redis Connection
listen = ['ai_factory_jobs']
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
conn = redis.from_url(redis_url)

def on_success(job, connection, result, *args, **kwargs):
    """Publish success and notify n8n."""
    msg = json.dumps({
        "job_id": job.id,
        "status": "finished",
        "result": result,
        "influencer_id": job.args[0] if job.args else "unknown"
    })
    connection.publish("ai_factory_updates", msg)
    print(f" [✓] Job {job.id} finished.")

    # Trigger n8n Automation
    n8n_url = os.getenv("N8N_WEBHOOK_URL")
    if n8n_url:
        try:
            print(f" [n8n] Triggering automation for {job.id}...")
            requests.post(
                n8n_url,
                json={
                    "event": "generation_complete",
                    "job_id": job.id,
                    "influencer_id": job.args[0] if job.args else "unknown",
                    "result": result
                },
                headers={"X-API-Key": os.getenv("INTERNAL_API_KEY", "")},
                timeout=10
            )
        except Exception as e:
            print(f" [n8n] Error: {e}")

def on_failure(job, connection, type, value, traceback, *args, **kwargs):
    """Publish failure event to Redis Pub/Sub."""
    msg = json.dumps({
        "job_id": job.id,
        "status": "failed",
        "error": str(value),
        "influencer_id": job.args[0] if job.args else "unknown"
    })
    connection.publish("ai_factory_updates", msg)
    print(f" [❌] Job {job.id} failed and published.")

if __name__ == '__main__':
    with Connection(conn):
        worker = Worker(
            map(Queue, listen),
            on_success=on_success,
            on_failure=on_failure
        )
        print("Starting RQ Worker (with Pub/Sub updates) for AI Factory...")
        worker.work()
