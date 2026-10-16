#!/usr/bin/env python3
"""Render ACPro PNG icons from the brand's existing original SVG assets."""
from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

def render(name, size):
    raw = (ASSETS / name).read_bytes()
    return Image.open(BytesIO(cairosvg.svg2png(bytestring=raw,output_width=size,output_height=size))).convert("RGBA")

def save(img, name):
    method = Image.Quantize.MEDIANCUT if img.mode == "RGB" else Image.Quantize.FASTOCTREE
    img.quantize(colors=128 if img.mode=="RGB" else 96,method=method).save(ASSETS/name,optimize=True)

for size in (512,1024):
    save(render("mark.svg",size),f"logo-{size}.png")
for size in (32,48):
    save(render("favicon.svg",size),f"favicon-{size}.png")
save(render("favicon.svg",180),"apple-touch-icon.png")

image=Image.new("RGB",(1200,630),"#f5fbff")
d=ImageDraw.Draw(image)
for y in range(630):
    t=y/630
    d.line([(0,y),(1200,y)],fill=(round(247-11*t),round(252-8*t),round(255-3*t)))
d.rounded_rectangle((60,55,1140,575),radius=46,fill="#ffffff",outline="#ddeaf4",width=3)
d.rounded_rectangle((65,60,1135,570),radius=42,outline="#f1f7fb",width=2)
d.rounded_rectangle((60,528,1140,575),radius=17,fill="#0988c9")
logo=render("mark.svg",260)
image.paste(logo,(110,184),logo)
font="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
regular="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
d.text((420,199),"ASTANA",font=ImageFont.truetype(font,63),fill="#092A4C")
d.text((420,278),"CLEANING PRO",font=ImageFont.truetype(font,52),fill="#0582b9")
d.text((422,380),"Профессиональный клининг в Астане",font=ImageFont.truetype(regular,26),fill="#34596d")
d.text((94,536),"ACPRO.KZ",font=ImageFont.truetype(font,23),fill="#ffffff")
save(image,"og-image-1200x630.png")
print("ACPro PNG assets generated from canonical SVG artwork")
