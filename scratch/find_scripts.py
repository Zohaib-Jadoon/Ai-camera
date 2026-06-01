import urllib.request
import re

def main():
    url = "http://localhost:3000"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            
            # Find all script tags
            script_tags = re.findall(r'<script[^>]*>.*?</script>', html, re.DOTALL)
            print(f"Total script tags: {len(script_tags)}")
            for idx, tag in enumerate(script_tags):
                # check if inline (doesn't have src=)
                if 'src=' not in tag:
                    print(f"\n--- Inline Script {idx} ---")
                    print(tag[:500])
                    if len(tag) > 500:
                        print("... (truncated)")
                else:
                    print(f"External Script: {tag}")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
