# One-top try-on

ReWear sends two explicitly selected images to a local service: a person photo and one top. The service runs one upper-body request at a time. Person photos and previews are kept out of IndexedDB. The service uses temporary files and cleans them up when a job finishes. The upstream provider handles its own files and retention.

## Start locally

Install Python 3.12. From the repository root, create and activate a virtual environment in a second terminal.

```powershell
# Windows PowerShell
py -3.12 -m venv vton_service/.venv
. .\vton_service\.venv\Scripts\Activate.ps1
$env:VTON_URL = 'yisol/IDM-VTON'
```

```sh
# macOS or Linux
python3.12 -m venv vton_service/.venv
source vton_service/.venv/bin/activate
export VTON_URL=yisol/IDM-VTON
```

Install dependencies and log in with your own [Hugging Face read token](https://huggingface.co/settings/tokens). The prompt hides the token as you paste it.

```sh
python -m pip install -r vton_service/requirements.txt
python -c "from getpass import getpass; from huggingface_hub import login; login(token=getpass('Hugging Face token: '), skip_if_logged_in=False)"
python -m uvicorn main:app --app-dir vton_service --host 127.0.0.1 --port 8000 --no-access-log
```

Set `VTON_SERVICE_URL=http://127.0.0.1:8000` in the ReWear project's `.env.local` and restart ReWear. Check `http://127.0.0.1:8000/health` on the host for `{"configured":true}`, then check `/api/tryon` on the ReWear address in your browser for the same response. These checks confirm the services have their URLs configured. Generate a preview to verify the GPU connection.

When using [ReWear over Tailscale](../README.md#use-one-url-from-home-or-away), open the ReWear URL on your phone. The Node server reaches Python on port `8000` on the host. A hosted Python service can use a server-only `HF_TOKEN`. A custom Gradio provider can be set through `VTON_URL` and must expose a compatible `/tryon` endpoint.

Open **Try-on** in ReWear. Choose a person photo and a separate photo of a top, add an optional description, and select **Generate preview**. Canceling stops the request and asks the upstream job to cancel. A remote request that has already started may finish on the provider. The preview is a visual approximation.

The public [IDM-VTON demo](https://huggingface.co/spaces/yisol/IDM-VTON) masks the upper body. Its [model and code license](https://github.com/yisol/IDM-VTON#license) is CC BY-NC-SA 4.0. The shared GPU may be busy or unavailable.
