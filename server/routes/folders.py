# INSERT_YOUR_CODE
from logging import root
from fastapi import APIRouter, HTTPException, Request, status, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional


from config.mongo import connect_to_mongo


from langchain.agents import create_agent
import os

from helpers.auth import login_required
from models import ChatSession, Folder, Session, SessionDoc
import asyncio

router = APIRouter(prefix="/folders", tags=["folders"])
connect_to_mongo()


#in client if not chat_session id create new one, and then load it
@router.get("/{parent_id}/content")
@login_required
async def get_folder_content(
    parent_id: str,
    user_id=None,
    request: Request = None,
):
    parent = None if parent_id == 'root' else parent_id

    

    async def get_folders(parent):
        return list(Folder.objects(parent_id=parent))

    async def get_chats(parent):
        if parent is None:
            return []
        return list(ChatSession.objects(folder_id=parent))

    async def get_docs(parent):
        if parent is None:
            return []
        return list(SessionDoc.objects(folder_id=parent))

    async def get_sessions(parent):
        if parent is None:
            return []
        return list(Session.objects(folder_id=parent))

    folders, chats, docs, sessions = await asyncio.gather(
        get_folders(parent),
        get_chats(parent),
        get_docs(parent),
        get_sessions(parent)
    )

    content = []
    content.extend([{**folder.to_dict(), "type": "folder"} for folder in folders])
    content.extend([{**chat.to_dict(), "type": "chat"} for chat in chats])
    content.extend([{**doc.to_dict(), "type": "doc"} for doc in docs])
    content.extend([{**session.to_dict(), "type": "session"} for session in sessions])

    return {"content": content}

    # INSERT_YOUR_CODE


@router.post("/add-to-folder")
@login_required
async def add_to_folder(request: Request, user_id=None):
    """
    Adds a resource (Session, SessionDoc, or ChatSession) to a specified folder.
    Expects JSON: {
        "resource_type": "session" | "doc" | "chat",
        "resource_id": "<id>",
        "folder_id": "<folder_id>"
    }
    """
    data = await request.json()
    resource_type = data.get("resource_type")
    resource_id = data.get("resource_id")
    folder_id = data.get("folder_id")
    print(folder_id)
    if not resource_type or not resource_id or not folder_id:
        return JSONResponse(status_code=400, content={"error": "Missing fields in request."})

    folder = Folder.objects(id=folder_id).first()
    if not folder:
        return JSONResponse(status_code=404, content={"error": "Folder not found."})

    model_map = {
        "session": Session,
        "doc": SessionDoc,
        "chat": ChatSession
    }
    Model = model_map.get(resource_type)
    if not Model:
        return JSONResponse(status_code=400, content={"error": "Invalid resource_type."})

    instance = Model.objects(id=resource_id, owner_id=user_id).first()
    if not instance:
        return JSONResponse(status_code=404, content={"error": f"{resource_type} not found for this user."})
    
    instance.folder_id = folder.id
    instance.save()

    return {"message": f"{resource_type.capitalize()} added to folder.", "resource": instance.to_dict()}


    # INSERT_YOUR_CODE


@router.post("/remove")
@login_required
async def remove_from_folder(request: Request, user_id=None):
    """
    Removes a resource (Session, SessionDoc, or ChatSession) from its folder.
    Expects JSON: {
        "resource_type": "session" | "doc" | "chat",
        "resource_id": "<id>"
    }
    """
    data = await request.json()
    resource_type = data.get("resource_type")
    resource_id = data.get("resource_id")
    if not resource_type or not resource_id:
        return JSONResponse(status_code=400, content={"error": "Missing fields in request."})

    model_map = {
        "session": Session,
        "doc": SessionDoc,
        "chat": ChatSession
    }
    Model = model_map.get(resource_type)
    if not Model:
        return JSONResponse(status_code=400, content={"error": "Invalid resource_type."})

    instance = Model.objects(id=resource_id, owner_id=user_id).first()
    if not instance:
        return JSONResponse(status_code=404, content={"error": f"{resource_type} not found for this user."})

    # Remove folder association by setting folder_id to None
    instance.folder_id = None
    instance.save()

    return {"message": f"{resource_type.capitalize()} removed from folder.", "resource": instance.to_dict()}

 # INSERT_YOUR_CODE


@router.post("/")
@login_required
async def create_folder(request: Request, user_id=None):
    """
    Create a new folder. Expects JSON: { "title": "<Folder Title>", "parent_id": "<optional parent folder id or null or 'root'>" }
    If parent_id is 'root', parent_id will be set to None.
    """
    data = await request.json()
    title = data.get("title")
    parent_id = data.get("parent_id")  # can be None, 'root', or a folder id

    if not title or not isinstance(title, str):
        return JSONResponse(status_code=400, content={"error": "Folder title is required."})


    # If parent_id is "root", treat it as None
    if parent_id == "root":
        parent_id = None
    print("Parent folder",parent_id)
    parent_folder = None
    if parent_id:
        parent_folder = Folder.objects(id=parent_id, owner_id=user_id).first()
        if not parent_folder:
            return JSONResponse(status_code=404, content={"error": "Parent folder not found."})

    folder = Folder(
        title=title.strip(),
        owner_id=user_id,
        parent_id=parent_folder.id if parent_folder else None
    )
    folder.save()
    return {"folder": folder.to_dict()}


@router.delete("/{folder_id}")
@login_required
async def delete_folder(folder_id: str, request:Request, user_id=None):
    """
    Delete a folder and all its subfolders recursively.
    - Any doc, session, or note using this folder will have its folder_id set to None.
    """
   
    # Recursive function to gather all nested folder ids, topological
    # Efficient recursive folder and resource deletion using bulk operations
    def gather_all_folder_ids(folder_id):
        """Recursively gather all folder ids below and including folder_id (postorder)."""
        ids = []
        folders_to_check = [folder_id]
        while folders_to_check:
            current = folders_to_check.pop()
            children = Folder.objects(parent_id=current, owner_id=user_id).scalar('id')
            folders_to_check.extend(children)
            ids.append(current)
        return ids

    # Collect all folders under this folder (including itself) using postorder (children before parent)
    all_folder_ids = gather_all_folder_ids(folder_id)
    # To delete children before parents, reverse (children-first/postorder)
    all_folder_ids = all_folder_ids[::-1]

    # Unlink all SessionDoc, ChatSession, and Session records in those folders in bulk
    SessionDoc.objects(folder_id__in=all_folder_ids, owner_id=user_id).update(set__folder_id=None)
    ChatSession.objects(folder_id__in=all_folder_ids, owner_id=user_id).update(set__folder_id=None)
    Session.objects(folder_id__in=all_folder_ids, owner_id=user_id).update(set__folder_id=None)

    # Bulk delete all folders for this user in one go
    Folder.objects(id__in=all_folder_ids, owner_id=user_id).delete()



    return {"message": "Folder and all subfolders deleted. All resources previously in these folders have been unlinked."}
