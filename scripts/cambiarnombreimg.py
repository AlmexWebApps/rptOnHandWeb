import os

BASE_PATH = r"C:\Users\21585\Documents\Dev\rptOnHandWeb\assets\items"

for folder_name in os.listdir(BASE_PATH):
    folder_path = os.path.join(BASE_PATH, folder_name)

    if not os.path.isdir(folder_path):
        continue

    files = [
        f for f in os.listdir(folder_path)
        if os.path.isfile(os.path.join(folder_path, f))
    ]

    if not files:
        print(f"⚠️ Carpeta vacía: {folder_name}")
        continue

    original_file = files[0]
    _, ext = os.path.splitext(original_file)

    new_name = folder_name + ext
    old_path = os.path.join(folder_path, original_file)
    new_path = os.path.join(folder_path, new_name)

    if os.path.exists(new_path):
        print(f"❌ Ya existe {new_name} en {folder_name}")
        continue

    os.rename(old_path, new_path)
    print(f"✅ {original_file} → {new_name}")