from transformers import AutoImageProcessor

try:
    processor = AutoImageProcessor.from_pretrained("microsoft/cvt-13", local_files_only=True)
    print(processor)
except Exception as e:
    print("Error:", e)
