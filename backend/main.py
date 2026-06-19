import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .db import Base, engine
from .routers import konten, darlehen, depots, sachvermoegen, spending, versicherungen, notfall, networth

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title='MeinFinanzblick API',
    description='Privates lokales Finanz-Dashboard',
    version='1.0.0',
)

app.include_router(konten.router, prefix='/api/v1')
app.include_router(darlehen.router, prefix='/api/v1')
app.include_router(depots.router, prefix='/api/v1')
app.include_router(sachvermoegen.router, prefix='/api/v1')
app.include_router(spending.router, prefix='/api/v1')
app.include_router(versicherungen.router, prefix='/api/v1')
app.include_router(notfall.router, prefix='/api/v1')
app.include_router(networth.router, prefix='/api/v1')

FRONTEND = os.path.join(os.path.dirname(__file__), '..', 'frontend')

app.mount('/css', StaticFiles(directory=os.path.join(FRONTEND, 'css')), name='css')
app.mount('/js', StaticFiles(directory=os.path.join(FRONTEND, 'js')), name='js')


@app.get('/')
def root():
    return FileResponse(os.path.join(FRONTEND, 'index.html'))
