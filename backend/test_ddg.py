from ddgs import DDGS

def test_ddg():
    results = DDGS().text("turnbackhoax pocong depok", max_results=3)
    print(results)

if __name__ == "__main__":
    test_ddg()
