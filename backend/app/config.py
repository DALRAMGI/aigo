from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    s3_endpoint_url: str = ""
    s3_bucket: str = "dashpi-videos"
    s3_region: str = "auto"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwt_key: str = ""
    web_origin: str = "http://localhost:3000"
    toss_secret_key: str
    openai_api_key: str = ""
    openai_model: str = "gpt-5.5"
    openai_reasoning_effort: str = "low"
    max_video_bytes: int = 209715200
    max_video_seconds: int = 120
    user_daily_limit: int = 5
    global_daily_limit: int = 100

    @field_validator("toss_secret_key")
    @classmethod
    def _toss_test_key_only(cls, v: str) -> str:
        if not v.startswith("test_"):
            raise ValueError("토스 키는 test_ 로 시작해야 합니다 (실결제 키 금지).")
        return v


settings = Settings()
