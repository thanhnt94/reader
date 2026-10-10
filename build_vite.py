import os
import subprocess
import sys
import shutil

def fix_lookbehinds(base_dir):
    """Replaces all positive lookbehinds with non-capturing groups to support older WebKit/iOS versions."""
    assets_dir = os.path.join(base_dir, "app", "static", "dist", "assets")
    if not os.path.exists(assets_dir):
        return
    
    print(" [VITE] Post-processing assets to remove Regex Lookbehinds...")
    found = False
    for f in os.listdir(assets_dir):
        if f.endswith(".js"):
            path = os.path.join(assets_dir, f)
            try:
                with open(path, "r", encoding="utf-8") as file_obj:
                    content = file_obj.read()
                if "(?<=" in content:
                    print(f"  [+] Replacing lookbehinds in {f}")
                    content = content.replace("(?<=", "(?:")
                    with open(path, "w", encoding="utf-8") as file_obj:
                        file_obj.write(content)
                    found = True
            except Exception as e:
                print(f"  [-] Failed to process {f}: {e}")
    if not found:
        print("  [+] No lookbehinds found in assets.")

def build_frontend():
    """Builds the Vite frontend and outputs it to app/static/dist."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "client")
    dist_assets_dir = os.path.join(base_dir, "app", "static", "dist", "assets")
    
    if not os.path.exists(frontend_dir):
        print(" [!] Client directory not found.")
        return False
        
    print(f" [VITE] Building Reader Frontend at {frontend_dir}...")
    
    if os.path.exists(dist_assets_dir):
        print(" [VITE] Cleaning up stale dist assets...")
        shutil.rmtree(dist_assets_dir, ignore_errors=True)
    
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    npx_cmd = "npx.cmd" if os.name == "nt" else "npx"
    
    try:
        bin_check = os.path.join(frontend_dir, "node_modules", ".bin")
        if not os.path.exists(bin_check) or not os.listdir(bin_check):
            print(" [VITE] Installing dependencies...")
            subprocess.run([npm_cmd, "install"], cwd=frontend_dir, shell=(os.name == "nt"), check=True)
            
        print(" [VITE] Running TypeScript type check...")
        subprocess.run([npx_cmd, "tsc", "-p", "tsconfig.app.json", "--noEmit"], cwd=frontend_dir, shell=(os.name == "nt"), check=True)

        print(" [VITE] Compiling production bundle...")
        subprocess.run([npm_cmd, "run", "build"], cwd=frontend_dir, shell=(os.name == "nt"), check=True)
        
        fix_lookbehinds(base_dir)
        print(" [VITE] Build successful!")
        return True
    except subprocess.CalledProcessError as e:
        print(f" [VITE] Build failed: {e}")
        return False
    except FileNotFoundError:
        print(" [!] 'npm' command not found. Is Node.js installed?")
        return False

if __name__ == "__main__":
    success = build_frontend()
    sys.exit(0 if success else 1)
