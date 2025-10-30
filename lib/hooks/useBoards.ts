"use client";

import { useUser } from "@clerk/nextjs";
import {
  boardDataService,
  boardService,
  columnService,
  taskService,
} from "../services";
import { useEffect, useState } from "react";
import { Board, ColumnWithTasks, Task } from "../supabase/models";
import { useSupabase } from "../supabase/SupabaseProvider";

// Helper function to calculate the first reminder time for recurring reminders
function getFirstReminderTime(reminderInterval: string): Date | null {
    if (reminderInterval === 'none' || !reminderInterval) return null;
    const nextTime = new Date();
    // Schedule the first reminder to be very soon (e.g., 1 min) to start the cycle
    nextTime.setMinutes(nextTime.getMinutes() + 1); 
    return nextTime;
}

export function useBoards() {
  const { user } = useUser();
  const { supabase } = useSupabase();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && supabase) {
      loadBoards();
    }
  }, [user, supabase]);

  async function loadBoards() {
    if (!user || !supabase) return;

    try {
      setLoading(true);
      setError(null);
     const data = await boardService.getBoards(supabase);
      setBoards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards.");
    } finally {
      setLoading(false);
    }
  }

  async function createBoard(boardData: {
    title: string;
    description?: string;
    color?: string;
  }) {
    if (!user || !supabase) throw new Error("User not authenticated");

    try {
      const newBoard = await boardDataService.createBoardWithDefaultColumns(
        supabase,
        {
          ...boardData,
          userId: user.id,
        }
      );
      setBoards((prev) => [newBoard, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board.");
    }
  }

  return { boards, loading, error, createBoard };
}

export function useBoard(boardId: string) {
  const { supabase } = useSupabase();
  const { user } = useUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (boardId && supabase) {
      loadBoard();
    }
  }, [boardId, supabase]);

  async function loadBoard() {
    if (!boardId || !supabase) return;

    try {
      setLoading(true);
      setError(null);
      const data = await boardDataService.getBoardWithColumns(
        supabase,
        boardId
      );
      setBoard(data.board);
      setColumns(data.columnsWithTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBoard(boardId: string, updates: Partial<Board>) {
    if (!supabase) return;
    try {
      const updatedBoard = await boardService.updateBoard(
        supabase,
        boardId,
        updates
      );
      setBoard(updatedBoard);
      return updatedBoard;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the board."
      );
    }
  }

  async function createRealTask(
    columnId: string,
    taskData: {
      title: string;
      description?: string;
      assignee?: string;
      dueDate?: string;
      priority?: "low" | "medium" | "high";
      reminder?: "none" | "15 min" | "1 hour" | "3 hour";
    }
  ) {
    if (!supabase) return;
    try {
      const firstReminderTime = getFirstReminderTime(taskData.reminder || 'none');
      
      const newTask = await taskService.createTask(supabase, {
        title: taskData.title,
        description: taskData.description || null,
        assignee: taskData.assignee || null,
        due_date: taskData.dueDate || null,
        column_id: columnId,
        sort_order:
          columns.find((col) => col.id === columnId)?.tasks.length || 0,
        priority: taskData.priority || "medium",
        reminder: taskData.reminder || "none",
        next_reminder_at: firstReminderTime ? firstReminderTime.toISOString() : null,
      });

      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, tasks: [...col.tasks, newTask] } : col
        )
      );

      return newTask;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create the task."
      );
    }
  }
  
  async function updateTask(taskId: string, updates: Partial<Task>) {
    if (!supabase) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update the task.');
      }

      const updatedTask = await response.json();

      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((task) =>
            task.id === taskId ? { ...task, ...updatedTask } : task
          ),
        }))
      );

      return updatedTask;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the task."
      );
    }
  }

  async function moveTask(
    taskId: string,
    newColumnId: string,
    newOrder: number
  ) {
    if (!supabase) return;
    try {
      await taskService.moveTask(supabase, taskId, newColumnId, newOrder);

      setColumns((prev) => {
        const newColumns = JSON.parse(JSON.stringify(prev));
        let taskToMove: Task | null = null;
        
        for (const col of newColumns) {
          const taskIndex = col.tasks.findIndex((t: Task) => t.id === taskId);
          if (taskIndex > -1) {
            taskToMove = col.tasks[taskIndex];
            col.tasks.splice(taskIndex, 1);
            break;
          }
        }

        if (taskToMove) {
          const targetCol = newColumns.find((c: ColumnWithTasks) => c.id === newColumnId);
          if (targetCol) {
            targetCol.tasks.splice(newOrder, 0, taskToMove);
          }
        }
        
        return newColumns;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task.");
    }
  }

  async function createColumn(title: string) {
    if (!board || !user || !supabase) throw new Error("Board not loaded");

    try {
      const newColumn = await columnService.createColumn(supabase, {
        title,
        board_id: board.id,
        sort_order: columns.length,
        user_id: user.id,
      });

      setColumns((prev) => [...prev, { ...newColumn, tasks: [] }]);
      return newColumn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column.");
    }
  }

  async function updateColumn(columnId: string, title: string) {
    if (!supabase) return;
    try {
      const updatedColumn = await columnService.updateColumnTitle(
        supabase,
        columnId,
        title
      );

      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, ...updatedColumn } : col
        )
      );

      return updatedColumn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column.");
    }
  }

  return {
    board,
    columns,
    loading,
    error,
    updateBoard,
    createRealTask,
    setColumns,
    moveTask,
    createColumn,
    updateColumn,
    updateTask,
  };
}