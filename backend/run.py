import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting OrderFlow Incident Demo Service on http://127.0.0.1:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
