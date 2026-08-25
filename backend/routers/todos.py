from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Todo
from ..schemas import (
    TodoCreate, TodoUpdate, TodoResponse,
)

router = APIRouter(tags=['Todos'])


# ── Todos ──────────────────────────────────────────────────────────────────────

@router.get('/todos/', response_model=list[TodoResponse])
def list_todos(db: Session = Depends(get_db)):
    return db.query(Todo).order_by(Todo.erledigt, Todo.sort_order, Todo.erstellt_am).all()


@router.post('/todos/', response_model=TodoResponse, status_code=201)
def create_todo(data: TodoCreate, db: Session = Depends(get_db)):
    obj = Todo(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


@router.put('/todos/{todo_id}', response_model=TodoResponse)
def update_todo(todo_id: int, data: TodoUpdate, db: Session = Depends(get_db)):
    obj = db.get(Todo, todo_id)
    if not obj:
        raise HTTPException(404, 'Todo nicht gefunden')
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj


@router.delete('/todos/{todo_id}', status_code=204)
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    obj = db.get(Todo, todo_id)
    if not obj:
        raise HTTPException(404, 'Todo nicht gefunden')
    db.delete(obj); db.commit()


