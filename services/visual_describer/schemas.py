"""Pydantic schemas used by the local AI visual describer service."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DescribeRequest(BaseModel):
    """Payload sent by the Node backend to describe a product visually."""

    product_id: str = Field(default="", max_length=120)
    slug: str = Field(default="", max_length=160)
    title: str = Field(..., min_length=1, max_length=220)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="", max_length=100)
    material: str = Field(default="", max_length=200)
    image_path: str = Field(default="")
    image_url: str = Field(default="")
    image_data_url: str = Field(default="")


class LanguageDescription(BaseModel):
    """Generated short and long descriptions for one language."""

    short: str = ""
    long: str = ""


class DescribeResponse(BaseModel):
    """Normalized description response returned to the Node backend."""

    descriptions: dict[str, LanguageDescription]
    styleTags: list[str]
    occasionTags: list[str]
    dominantColors: list[str]
    visualTraits: list[str]
    semanticTags: list[str]
    model: str
    caption: str


class SpeakRequest(BaseModel):
    """Payload for generating a spoken audio description."""

    text: str = Field(..., min_length=1, max_length=4000)
    product_id: str = Field(default="product", max_length=120)
    language: str = Field(default="en", max_length=10)
    detail_level: str = Field(default="short", max_length=20)


class SpeakResponse(BaseModel):
    """Response describing the generated or cached audio file."""

    audio_url: str
    audio_path: str
    cached: bool
