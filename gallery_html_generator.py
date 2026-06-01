from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, BooleanVar, Button, Checkbutton, Entry, Frame, Label, Listbox, StringVar, Tk, filedialog, messagebox

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
except ImportError:
    DND_FILES = None
    TkinterDnD = None


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "src" / "pages" / "ps" / "galeriak" / "2025-26"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff"}
ALT_TEXT = "lórum ipse"
TITLE_TEXT = "Cím"


@dataclass
class GalleryData:
    source_dir: Path
    output_file: Path
    layout: str
    title: str
    count: int
    date: str
    school_key: str
    slug: str
    year: str


@dataclass
class GalleryListItem:
    slug: str
    title: str
    date: str


def normalize_slug(folder_name: str) -> str:
    return folder_name.replace("-", "_")


def parse_date(slug: str) -> tuple[int, int, int]:
    match = re.match(r"^(\d{4})[_ -](\d{2})[_ -](\d{2})(?:[_ -]|$)", slug)
    if not match:
        raise ValueError(f"A mappanév elején nincs dátum: {slug}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def school_year(year: int, month: int) -> str:
    start = year if month >= 9 else year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def count_gallery_files(source_dir: Path) -> int:
    full_dir = source_dir / "full"
    count_dir = full_dir if full_dir.is_dir() else source_dir
    return sum(1 for item in count_dir.iterdir() if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS)


def build_gallery(source_dir: Path, output_dir: Path, school_key: str) -> GalleryData:
    slug = normalize_slug(source_dir.name)
    year_num, month, day = parse_date(slug)
    year_value = school_year(year_num, month)
    output_file = output_dir / f"{slug}.html"
    return GalleryData(
        source_dir=source_dir,
        output_file=output_file,
        layout=f"two_columns_{school_key}",
        title=TITLE_TEXT,
        count=count_gallery_files(source_dir),
        date=f"{year_num}. {month:02d}. {day:02d}.",
        school_key=school_key,
        slug=slug,
        year=year_value,
    )


def render_html(data: GalleryData) -> str:
    return (
        "---\n"
        f"layout: {data.layout}\n"
        f"title: {data.title}\n"
        f"alt: {ALT_TEXT}\n"
        f"count: {data.count}\n"
        f"date: {data.date}\n"
        f"schoolKey: {data.school_key}\n"
        f"slug: {data.slug}\n"
        f"year: '{data.year}'\n"
        "---\n\n"
        "{{> gallery-breadcrumb}} {{> common-galery-from-yaml}}\n"
    )


def yaml_single_quote(value: str) -> str:
    return value.replace("'", "''")


def yaml_title(title: str) -> str:
    return title


def data_yaml_path(data: GalleryData) -> Path:
    year_key = data.year.replace("-", "_")
    return PROJECT_ROOT / "src" / "data" / f"gal_picts_{data.school_key}_{year_key}.yml"


def parse_gallery_yaml(text: str) -> list[GalleryListItem]:
    pattern = re.compile(
        r"  - slug: '([^']*)'\s*\n"
        r"    title: '((?:[^']|'')*)'\s*\n"
        r"    date: '([^']*)'",
        re.MULTILINE,
    )
    return [
        GalleryListItem(
            slug=match.group(1),
            title=match.group(2).replace("''", "'"),
            date=match.group(3),
        )
        for match in pattern.finditer(text)
    ]


def date_sort_key(item: GalleryListItem) -> tuple[int, int, int, str]:
    match = re.match(r"^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.$", item.date)
    if not match:
        return (0, 0, 0, item.slug)
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)), item.slug)


def render_gallery_yaml(items: list[GalleryListItem]) -> str:
    lines = ["cards:"]
    for item in items:
        lines.extend(
            [
                f"  - slug: '{yaml_single_quote(item.slug)}'",
                f"    title: '{yaml_single_quote(item.title)}'",
                f"    date: '{yaml_single_quote(item.date)}'",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def update_gallery_yaml_files(galleries: list[GalleryData]) -> tuple[int, list[Path]]:
    grouped: dict[Path, list[GalleryData]] = {}
    for gallery in galleries:
        grouped.setdefault(data_yaml_path(gallery), []).append(gallery)

    added_count = 0
    updated_files: list[Path] = []
    for yaml_path, yaml_galleries in grouped.items():
        if yaml_path.exists():
            existing_items = parse_gallery_yaml(yaml_path.read_text(encoding="utf-8"))
        else:
            existing_items = []

        by_slug = {item.slug: item for item in existing_items}
        for gallery in yaml_galleries:
            if gallery.slug in by_slug:
                continue
            by_slug[gallery.slug] = GalleryListItem(
                slug=gallery.slug,
                title=yaml_title(gallery.title),
                date=gallery.date,
            )
            added_count += 1

        sorted_items = sorted(by_slug.values(), key=date_sort_key, reverse=True)
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        yaml_path.write_text(render_gallery_yaml(sorted_items), encoding="utf-8")
        updated_files.append(yaml_path)

    return added_count, updated_files


class GalleryGeneratorApp:
    def __init__(self) -> None:
        root_class = TkinterDnD.Tk if TkinterDnD else Tk
        self.root = root_class()
        self.root.title("Galéria HTML generátor")
        self.root.geometry("820x560")
        self.school_key = StringVar(value="ps")
        self.ps_checked = BooleanVar(value=True)
        self.bs_checked = BooleanVar(value=False)
        self.update_yaml_checked = BooleanVar(value=True)
        self.output_dir = StringVar(value=str(DEFAULT_OUTPUT_DIR))
        self.status = StringVar(value="Húzd ide a galéria képmappákat, vagy válaszd ki őket a gombbal.")
        self.folders: list[Path] = []

        self._build_ui()

    def _build_ui(self) -> None:
        top = Frame(self.root, padx=12, pady=10)
        top.pack(fill="x")

        Label(top, text="Tartalom:").pack(side=LEFT)
        Checkbutton(top, text="ps (Petőfi)", command=lambda: self._select_school("ps"), variable=self.ps_checked).pack(side=LEFT, padx=(10, 0))
        Checkbutton(top, text="bs (Bálint)", command=lambda: self._select_school("bs"), variable=self.bs_checked).pack(side=LEFT, padx=(10, 20))

        drop_frame = Frame(self.root, padx=12, pady=8)
        drop_frame.pack(fill=BOTH, expand=True)
        Label(drop_frame, text="Húzd ide a galéria képmappákat:").pack(anchor="w")
        self.listbox = Listbox(drop_frame, selectmode="extended")
        self.listbox.pack(fill=BOTH, expand=True, pady=(4, 8))

        if DND_FILES:
            self.listbox.drop_target_register(DND_FILES)
            self.listbox.dnd_bind("<<Drop>>", self._handle_drop)
        else:
            self.status.set("Drag and drop használatához telepítsd: pip install tkinterdnd2. A tallózás most is működik.")

        browse = Frame(self.root, padx=12, pady=6)
        browse.pack(fill="x")
        Button(browse, text="Képmappák tallózása", command=self._choose_folders).pack(side=LEFT)
        Button(browse, text="Lista törlése", command=self._clear_folders).pack(side=LEFT, padx=(8, 0))

        options = Frame(self.root, padx=12, pady=6)
        options.pack(fill="x")
        Checkbutton(
            options,
            text="YAML lista frissítése új slug/title/date elemekkel",
            variable=self.update_yaml_checked,
        ).pack(side=LEFT)

        output = Frame(self.root, padx=12, pady=6)
        output.pack(fill="x")
        Label(output, text="HTML célmappa:").pack(side=LEFT)
        Entry(output, textvariable=self.output_dir).pack(side=LEFT, fill="x", expand=True, padx=8)
        Button(output, text="Tallózás", command=self._choose_output_dir).pack(side=RIGHT)

        actions = Frame(self.root, padx=12, pady=8)
        actions.pack(fill="x")
        Button(actions, text="HTML fájlok generálása", command=self._generate).pack(side=RIGHT)
        Label(actions, textvariable=self.status, anchor="w").pack(side=LEFT, fill="x", expand=True)

    def _select_school(self, value: str) -> None:
        self.school_key.set(value)
        self.ps_checked.set(value == "ps")
        self.bs_checked.set(value == "bs")
        self.status.set(f"Kiválasztva: {value}")

    def _choose_folders(self) -> None:
        selected = filedialog.askdirectory(initialdir=PROJECT_ROOT / "src" / "assets" / "img", title="Galéria képmappa kiválasztása")
        if selected:
            self._add_folders([Path(selected)])

    def _choose_output_dir(self) -> None:
        selected = filedialog.askdirectory(initialdir=PROJECT_ROOT / "src" / "pages", title="HTML célmappa kiválasztása")
        if selected:
            self.output_dir.set(selected)

    def _handle_drop(self, event) -> None:
        paths = self.root.tk.splitlist(event.data)
        self._add_folders([Path(path) for path in paths])

    def _add_folders(self, paths: list[Path]) -> None:
        added = 0
        for path in paths:
            if path.is_dir() and path not in self.folders:
                self.folders.append(path)
                self.listbox.insert(END, str(path))
                added += 1
        self.status.set(f"{added} mappa hozzáadva. Összesen: {len(self.folders)}")

    def _clear_folders(self) -> None:
        self.folders.clear()
        self.listbox.delete(0, END)
        self.status.set("A lista üres.")

    def _generate(self) -> None:
        if not self.folders:
            messagebox.showwarning("Nincs képmappa", "Adj hozzá legalább egy galéria képmappát.")
            return

        output_dir = Path(self.output_dir.get()).expanduser()
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            messagebox.showerror("Célmappa hiba", f"Nem hozható létre a célmappa:\n{exc}")
            return

        created = 0
        errors: list[str] = []
        generated_galleries: list[GalleryData] = []
        for folder in self.folders:
            try:
                data = build_gallery(folder, output_dir, self.school_key.get())
                data.output_file.write_text(render_html(data), encoding="utf-8")
                created += 1
                generated_galleries.append(data)
            except Exception as exc:
                errors.append(f"{folder.name}: {exc}")

        yaml_added = 0
        yaml_files: list[Path] = []
        if generated_galleries and self.update_yaml_checked.get():
            try:
                yaml_added, yaml_files = update_gallery_yaml_files(generated_galleries)
            except Exception as exc:
                errors.append(f"YAML frissítés: {exc}")

        yaml_message = ""
        if yaml_files:
            yaml_names = ", ".join(path.name for path in yaml_files)
            yaml_message = f"\nYAML listaelemek hozzáadva: {yaml_added}\nFrissített fájlok: {yaml_names}"
        elif generated_galleries and not self.update_yaml_checked.get():
            yaml_message = "\nYAML lista frissítése kikapcsolva."

        if errors:
            messagebox.showwarning("Részben kész", f"{created} HTML fájl létrehozva.{yaml_message}\n\nHibák:\n" + "\n".join(errors))
        else:
            messagebox.showinfo("Kész", f"{created} HTML fájl létrehozva.{yaml_message}")
        if self.update_yaml_checked.get():
            self.status.set(f"Kész: {created} HTML fájl, {yaml_added} YAML listaelem.")
        else:
            self.status.set(f"Kész: {created} HTML fájl. YAML frissítés kikapcsolva.")

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        raise SystemExit("Python 3.10 vagy újabb szükséges.")
    GalleryGeneratorApp().run()
