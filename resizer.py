import os
import shutil
from tkinter import (
    Listbox,
    Button,
    END,
    Label,
    Radiobutton,
    IntVar,
    Checkbutton,
    BooleanVar,
)
from tkinterdnd2 import DND_FILES, TkinterDnD
from PIL import Image, ImageOps


# -----------------------------
#  Segédfüggvények
# -----------------------------
def resize_image(input_path, output_path, target_width, quality):
    with Image.open(input_path) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        w, h = img.size

        new_h = int(h * (target_width / w))
        resized = img.resize((target_width, new_h), Image.Resampling.LANCZOS)
        resized.save(output_path, "JPEG", quality=quality)



# -----------------------------
#  Mappa Feldolgozás
# -----------------------------
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def list_images(folder_path):
    return sorted(
        [
            name
            for name in os.listdir(folder_path)
            if os.path.isfile(os.path.join(folder_path, name))
            and os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
        ],
        key=str.lower,
    )


def process_folder(
    folder_path,
    digit_count,
    keep_full_size,
    keep_filenames,
    keep_originals=False,
):
    print(
        f"Feldolgozás: {folder_path} | "
        f"számjegyek: {digit_count} | "
        f"full eredeti méret: {keep_full_size} | "
        f"eredeti fájlnevek: {keep_filenames} | "
        f"eredetik megőrzése: {keep_originals}"
    )

    full_dir = os.path.join(folder_path, "full")
    thumb_dir = os.path.join(folder_path, "thumb")
    original_dir = os.path.join(folder_path, "original")
    os.makedirs(full_dir, exist_ok=True)
    os.makedirs(thumb_dir, exist_ok=True)
    if keep_originals:
        os.makedirs(original_dir, exist_ok=True)

    files = list_images(folder_path)

    # -----------------------------
    #  ÁTNEVEZÉS, ha nincs kikapcsolva
    # -----------------------------
    if not keep_filenames and files:
        # Kétfázisú átnevezés: így a 01.jpg nem írja felül a soron következő
        # feldolgozandó fájlt.
        temporary = []
        for index, filename in enumerate(files):
            extension = os.path.splitext(filename)[1].lower()
            temp_name = f"__resizer_tmp_{index:04d}{extension}"
            temp_path = os.path.join(folder_path, temp_name)
            os.replace(os.path.join(folder_path, filename), temp_path)
            temporary.append((temp_path, extension, filename))
        for index, (temp_path, extension, original_name) in enumerate(temporary, start=1):
            new_filename = f"{index:0{digit_count}d}{extension}"
            os.replace(temp_path, os.path.join(folder_path, new_filename))
            print(f"Átnevezve: {original_name} -> {new_filename}")

        files = list_images(folder_path)

    # -----------------------------
    #  FULL + THUMB létrehozás
    # -----------------------------
    for filename in files:
        base, _ext = os.path.splitext(filename)
        img_path = os.path.join(folder_path, filename)

        full_output = os.path.join(full_dir, f"{base}_full.jpg")
        thumb_output = os.path.join(thumb_dir, f"{base}_thumb.jpg")

        # FULL
        if keep_full_size:
            shutil.copy2(img_path, full_output)
        else:
            resize_image(img_path, full_output, target_width=1000, quality=90)

        # THUMB mindig 265 px széles
        resize_image(img_path, thumb_output, target_width=265, quality=85)

        print(f"Kész: {filename}")

        if keep_originals:
            os.replace(img_path, os.path.join(original_dir, filename))
        else:
            os.remove(img_path)

    print("Feldolgozás kész:", folder_path)
    print("------------------------------")



# -----------------------------
#  GUI
# -----------------------------
def drop(event):
    paths = root.splitlist(event.data)

    for p in paths:
        if os.path.isdir(p):
            folder_list.insert(END, p)


def clear_folder_list():
    folder_list.delete(0, END)
    print("Mappalista törölve.")


def run_processing():
    digit_count = digit_var.get()
    keep_full_size = keep_full_size_var.get()
    keep_filenames = keep_filenames_var.get()
    keep_originals = keep_originals_var.get()

    for i in range(folder_list.size()):
        folder = folder_list.get(i)
        process_folder(
            folder,
            digit_count,
            keep_full_size,
            keep_filenames,
            keep_originals,
        )

    print("Minden mappa feldolgozva.")


# -----------------------------
#  Ablak létrehozás
# -----------------------------
root = TkinterDnD.Tk()
root.title("Képméretező - full + thumb + automatikus átnevezés")
root.geometry("650x580")

Label(root, text="Húzd ide a mappákat (Drag & Drop)").pack(pady=5)

folder_list = Listbox(root, width=85, height=12)
folder_list.pack(pady=10)
folder_list.drop_target_register(DND_FILES)
folder_list.dnd_bind("<<Drop>>", drop)

Button(
    root,
    text="Lista törlése",
    command=clear_folder_list,
).pack(pady=(0, 10))

digit_var = IntVar(value=2)

Label(root, text="Fájlnév formátum átnevezés esetén:").pack()

Radiobutton(
    root,
    text="2 számjegyű (01, 02, 03, ...)",
    variable=digit_var,
    value=2,
).pack()

Radiobutton(
    root,
    text="3 számjegyű (001, 002, 003, ...)",
    variable=digit_var,
    value=3,
).pack()

keep_full_size_var = BooleanVar(value=False)
keep_filenames_var = BooleanVar(value=False)
keep_originals_var = BooleanVar(value=True)

Label(root, text="Extra beállítások:").pack(pady=(15, 0))

Checkbutton(
    root,
    text="Full képméret változatlanul hagyása",
    variable=keep_full_size_var,
).pack()

Checkbutton(
    root,
    text="Fájlnevek változatlanul hagyása",
    variable=keep_filenames_var,
).pack()

Checkbutton(
    root,
    text="Eredeti képek megőrzése (original mappa)",
    variable=keep_originals_var,
).pack()

Button(
    root,
    text="Feldolgozás indítása",
    command=run_processing,
).pack(pady=15)

root.mainloop()