from typing import List
# from routes.docs import Block


def compile_to_tiptap(blocks) -> dict:
    content = []
    # print(blocks)
    for block in blocks:
        if block.type == "heading":
            content.append({
                "type": "heading",
                "attrs": {"level": block.level},
                "content": [{"type": "text", "text": block.text}]
            })

        elif block.type == "paragraph":
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": block.text}]
            })

        elif block.type == "task":
            content.append({
                "type": "taskList",
                "content": [{
                    "type": "taskItem",
                    "attrs": {"checked": block.completed},
                    "content": [{
                        "type": "paragraph",
                        "content": [{"type": "text", "text": block.text}]
                    }]
                }]
            })

    return content