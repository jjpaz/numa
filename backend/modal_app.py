"""Minimal CPU API; no ML wheels, GPU or model Volume. Configuration via secrets."""
import modal

app = modal.App('numa')
image = (modal.Image.debian_slim(python_version='3.11')
    .apt_install('ffmpeg','libsndfile1')
    .pip_install_from_requirements('backend/requirements.txt')
    .env({'NUMA_ML_ENABLED':'false','NUMA_DEMO_MODE':'false'})
    .add_local_python_source('backend'))

@app.function(image=image,secrets=[modal.Secret.from_name('numa-secrets')],timeout=300,min_containers=0,buffer_containers=0,scaledown_window=30,max_containers=1)
@modal.asgi_app()
def api():
    from backend.app import create_app
    return create_app()
