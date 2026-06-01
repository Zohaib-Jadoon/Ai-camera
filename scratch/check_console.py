import sys
from playwright.sync_api import sync_playwright

def main():
    print("Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen for console errors
        def on_console(msg):
            print(f"[CONSOLE {msg.type}] {msg.text}")
            if msg.location:
                print(f"  at {msg.location.get('url')}:{msg.location.get('lineNumber')}")

        page.on("console", on_console)
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        try:
            print("Navigating to http://localhost:3000 ...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")
            print("Successfully loaded. Waiting 3 seconds...")
            page.wait_for_timeout(3000)
            
            # Print page content title/headings
            print("Page title:", page.title())
            headings = page.locator("h1, h2, h3").all_inner_texts()
            print("Headings found:", headings)
        except Exception as e:
            print("Error occurred during navigation:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    main()
