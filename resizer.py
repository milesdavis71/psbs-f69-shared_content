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
from PIL import Image


# -----------------------------
#  Segédfüggvények
# -----------------------------
def resize_image(input_path, output_path, target_width, quality):
    with Image.open(input_path) as img:
        img = img.convert("RGB")
        w, h = img.size

        new_h = int(h * (target_width / w))
        resized = img.resize((target_width, new_h), Image.Resampling.LANCZOS)
        resized.save(output_path, "JPEG", quality=quality)


# -----------------------------
#  Mappa Feldolgozás
# -----------------------------
def process_folder(folder_path, digit_count, keep_full_size, keep_filenames):
    print(
        f"Feldolgozás: {folder_path} | "
        f"számjegyek: {digit_count} | "
        f"full eredeti méret: {keep_full_size} | "
        f"eredeti fájlnevek: {keep_filenames}"
    )

    full_dir = os.path.join(folder_path, "full")
    thumb_dir = os.path.join(folder_path, "thumb")
    os.makedirs(full_dir, exist_ok=True)
    os.makedirs(thumb_dir, exist_ok=True)

    files = sorted(
        [f for f in os.listdir(folder_path) if f.lower().endswith(".jpg")]
    )

    # -----------------------------
    #  ÁTNEVEZÉS, ha nincs kikapcsolva
    # -----------------------------
    if not keep_filenames:
        for index, filename in enumerate(files, start=1):
            old_path = os.path.join(folder_path, filename)
            new_filename = f"{index:0{digit_count}d}.jpg"
            new_path = os.path.join(folder_path, new_filename)

            if filename != new_filename:
                os.rename(old_path, new_path)
                print(f"Átnevezve: {filename} -> {new_filename}")

        files = sorted(
            [f for f in os.listdir(folder_path) if f.lower().endswith(".jpg")]
        )

    # -----------------------------
    #  FULL + THUMB létrehozás
    # -----------------------------
    for filename in files:
        base, ext = os.path.splitext(filename)
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

        # eredeti törlése
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

    for i in range(folder_list.size()):
        folder = folder_list.get(i)
        process_folder(
            folder,
            digit_count,
            keep_full_size,
            keep_filenames,
        )

    print("Minden mappa feldolgozva.")


# -----------------------------
#  Ablak létrehozás
# -----------------------------
root = TkinterDnD.Tk()
root.title("Képméretező - full + thumb + automatikus átnevezés")
root.geometry("650x540")

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

digit_var = IntVar(value=3)

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

Button(
    root,
    text="Feldolgozás indítása",
    command=run_processing,
).pack(pady=15)

root.mainloop()