from fastapi import FastAPI

app = FastAPI(title="Cinema Booking API")

@app.get("/health")
def health():
    return {"status": "ok"}
