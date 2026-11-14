"""Deploy with: modal deploy -m backend.modal_app"""
import modal

app = modal.App('numa')
weights = modal.Volume.from_name('numa-model-weights',create_if_missing=True)
image = (modal.Image.debian_slim(python_version='3.11')
    .apt_install('ffmpeg','libsndfile1')
    .pip_install_from_requirements('backend/requirements.txt')
    .pip_install('torch==2.5.1','torchaudio==2.5.1','speechbrain==1.0.3','transformers==4.45.2','huggingface_hub==0.26.5')
    .env({'NUMA_MODEL_CACHE':'/models','HF_HOME':'/models/huggingface','NUMA_DEMO_MODE':'false'})
    .add_local_python_source('backend'))

@app.function(image=image,gpu='T4',volumes={'/models':weights},secrets=[modal.Secret.from_name('numa-secrets')],timeout=300,scaledown_window=300,max_containers=1)
@modal.asgi_app()
def api():
    from backend.app import create_app
    return create_app()
