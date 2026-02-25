from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, get_db, settings
from models import Base, User
from auth import get_password_hash
from routers import auth as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="电商智能运营平台 v2 API",
    version="0.1.0",
    description="人机混合执行流程平台后端服务",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)


@app.on_event("startup")
async def seed_default_users():
    """Create default users if they don't exist."""
    db = next(get_db())
    try:
        default_users = [
            {
                "username": "admin",
                "display_name": "管理员",
                "password": "admin123",
                "role": "admin",
            },
            {
                "username": "manager",
                "display_name": "张经理",
                "password": "manager123",
                "role": "manager",
            },
            {
                "username": "executor",
                "display_name": "李执行",
                "password": "executor123",
                "role": "executor",
            },
        ]
        for u in default_users:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                db.add(
                    User(
                        username=u["username"],
                        display_name=u["display_name"],
                        hashed_password=get_password_hash(u["password"]),
                        role=u["role"],
                    )
                )
        db.commit()
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "电商智能运营平台 v2 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
