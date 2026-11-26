import subprocess
import time
import os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = r"C:\Users\06165\Desktop\FreeLA\docs\img"
PORT = 3055

env = os.environ.copy()
env["PORT"] = str(PORT)

node_proc = subprocess.Popen(["node", "src/server.js"], cwd=r"C:\Users\06165\Desktop\FreeLA", env=env)
time.sleep(2)

tabs = [
    ("print_landing.png", f"http://localhost:{PORT}"),
    ("print_mural.png", f"http://localhost:{PORT}#mural"),
    ("print_escrow.png", f"http://localhost:{PORT}#escrow"),
    ("print_carteira.png", f"http://localhost:{PORT}#carteira"),
    ("print_notificacoes.png", f"http://localhost:{PORT}#notificacoes"),
    ("print_prestadores.png", f"http://localhost:{PORT}#prestadores"),
    ("print_admin.png", f"http://localhost:{PORT}#admin")
]

try:
    for filename, url in tabs:
        out_file = os.path.join(OUTPUT_DIR, filename)
        subprocess.run([
            CHROME_PATH,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--virtual-time-budget=2000",
            "--window-size=1280,820",
            f"--screenshot={out_file}",
            url
        ], check=True)
        print(f"✓ Screenshot gerado: {filename}")

finally:
    node_proc.terminate()
    node_proc.wait()
