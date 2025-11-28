"use client";

import { useUser } from "@clerk/nextjs";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MoreHorizontal, Pencil, Plus, User } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react"; // Import useSession for Outlook integration

import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/lib/hooks/useBoards";
import { useSupabase } from "@/lib/supabase/SupabaseProvider";
import { ColumnWithTasks, Task } from "@/lib/supabase/models";

// CHILD COMPONENT: Represents a column where tasks can be dropped.
function DroppableColumn({
  column,
  children,
  onCreateTask,
  onEditColumn,
}: {
  column: ColumnWithTasks;
  children: React.ReactNode;
  onCreateTask: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onEditColumn: (column: ColumnWithTasks) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`w-full lg:flex-shrink-0 lg:w-80 ${
        isOver ? "bg-blue-50 rounded-lg" : ""
      }`}
    >
      <div
        className={`bg-white rounded-lg shadow-sm border ${
          isOver ? "ring-2 ring-blue-300" : ""
        }`}
      >
        <div className="p-3 sm:p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                {column.title}
              </h3>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {column.tasks.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => onEditColumn(column)}
            >
              <MoreHorizontal />
            </Button>
          </div>
        </div>
        <div className="p-2">
          {children}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full mt-3 text-gray-500 hover:text-gray-700"
              >
                <Plus /> Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onCreateTask}>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input name="title" required placeholder="Enter task title" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    placeholder="Enter task description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assignee Email</Label>
                  <Input
                    name="assignee"
                    type="email"
                    placeholder="Enter assignee's email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reminder</Label>
                  <Select name="reminder" defaultValue="none">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="15 min">15 min</SelectItem>
                      <SelectItem value="1 hour">1 hour</SelectItem>
                      <SelectItem value="3 hour">3 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input name="dueDate" type="date" />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit">Create Task</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

// CHILD COMPONENT: Represents a draggable task card with admin controls.
function SortableTask({
  task,
  isAdmin,
  onEdit,
}: {
  task: Task;
  isAdmin: boolean;
  onEdit: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const styles = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const getPriorityColor = (p: string) =>
    ({
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-green-500",
    }[p] || "bg-gray-400");

  return (
    <div ref={setNodeRef} style={styles} {...listeners} {...attributes}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-gray-900 text-sm leading-tight flex-1 min-w-0 pr-2">
              {task.title}
            </h4>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent dnd listeners from firing
                  onEdit(task);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-600 line-clamp-2">
            {task.description || "No description."}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              {task.assignee && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  <span className="truncate">{task.assignee}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">{task.due_date}</span>
                </div>
              )}
            </div>
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${getPriorityColor(
                task.priority
              )}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// CHILD COMPONENT: The visual representation of the task being dragged.
function TaskOverlay({ task }: { task: Task }) {
  // We don't show admin controls on the drag overlay
  return <SortableTask task={task} isAdmin={false} onEdit={() => {}} />;
}

// MAIN COMPONENT: The entire board page.
export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser(); // Clerk user
  const { supabase } = useSupabase();
  const { data: session } = useSession(); // NextAuth/Outlook session
  
  // *** UPDATED LINE ***
  // Now, both "admin" and "superadmin" will see the edit controls
  const isAdmin = user?.publicMetadata?.role === "admin" || user?.publicMetadata?.role === "superadmin";

  const {
    board,
    columns,
    updateBoard,
    createRealTask,
    setColumns,
    moveTask,
    createColumn,
    updateColumn,
    updateTask,
  } = useBoard(id);

  // State for all modals and forms
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [isEditingColumn, setIsEditingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [editingColumn, setEditingColumn] =
    useState<ColumnWithTasks | null>(null);
  const [filters, setFilters] = useState({
    priority: [] as string[],
    dueDate: null as string | null,
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<any[]>([]); // State for task history

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // --- HANDLER FUNCTIONS ---

  function handleFilterChange(
    type: "priority" | "dueDate",
    value: string | string[] | null
  ) {
    setFilters((prev) => ({
      ...prev,
      [type]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      priority: [] as string[],
      dueDate: null as string | null,
    });
  }

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const taskData = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      assignee: (formData.get("assignee") as string) || undefined,
      dueDate: (formData.get("dueDate") as string) || undefined,
      priority:
        (formData.get("priority") as "low" | "medium" | "high") || "medium",
      reminder:
        (formData.get("reminder") as
          | "none"
          | "15 min"
          | "1 hour"
          | "3 hour") || "none",
    };
    if (!taskData.title.trim()) return;

    // Create the task in Supabase first
    const newTask = await createRealTask(columns[0].id, taskData);

    // If a due date and assignee were provided, create the Outlook event
    if (newTask && taskData.dueDate && taskData.assignee) {
      try {
          const outlookResponse = await fetch("/api/create-outlook-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newTask.title,
              description: newTask.description,
              dueDate: newTask.due_date,
              assigneeEmail: newTask.assignee, // Pass only assignee's email
            }),
          });
          if (!outlookResponse.ok) {
              console.error("Failed to create Outlook event:", await outlookResponse.text());
          }
      } catch (outlookError) {
          console.error("Error calling Outlook event API:", outlookError);
      }
    }

    // Send assignment email (if assignee exists)
    if (taskData.assignee) {
      try {
          const emailResponse = await fetch("/api/send-assignment-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: taskData.assignee, ...taskData }),
          });
           if (!emailResponse.ok) {
              console.error("Failed to send assignment email:", await emailResponse.text());
          }
      } catch(emailError) {
           console.error("Error calling assignment email API:", emailError);
      }
    }

    // Close the dialog
    const trigger = document.querySelector('[data-state="open"]');
    if (trigger instanceof HTMLElement) trigger.click();
  }


  async function handleOpenEditModal(task: Task) {
    setTaskToEdit(task);
    setIsEditingTask(true);

    // Fetch task history when opening the modal
    if (supabase) {
      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .eq('task_id', task.id)
        .order('changed_at', { ascending: false });

      if (error) {
          console.error("Error fetching task history:", error);
          setTaskHistory([]);
      } else {
          setTaskHistory(data || []);
      }
    }
  }

  async function handleUpdateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!taskToEdit) return;

    const formData = new FormData(e.currentTarget);
    const updates: Partial<Task> = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      assignee: (formData.get("assignee") as string) || undefined,
      due_date: (formData.get("dueDate") as string) || undefined,
      priority:
        (formData.get("priority") as "low" | "medium" | "high") || "medium",
      reminder:
        (formData.get("reminder") as
          | "none"
          | "15 min"
          | "1 hour"
          | "3 hour") || "none",
    };

    // If reminder settings change, reset next_reminder_at
    if (updates.due_date || updates.reminder) {
      updates.next_reminder_at = null;
    }

    await updateTask(taskToEdit.id, updates);
    setIsEditingTask(false);
    setTaskToEdit(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = columns
      .flatMap((c) => c.tasks)
      .find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  
    const sourceColumn = columns.find((c) =>
      c.tasks.some((t) => t.id === active.id)
    );
    const targetColumn = columns.find(
      (c) => c.id === over.id || c.tasks.some((t) => t.id === over.id)
    );
  
    if (!sourceColumn || !targetColumn || sourceColumn.id !== targetColumn.id)
      return;
  
    const activeIndex = sourceColumn.tasks.findIndex(
      (t) => t.id === active.id
    );
    const overIndex = targetColumn.tasks.findIndex((t) => t.id === over.id);
  
    if (activeIndex !== overIndex) {
      setColumns((prev) => {
        const newCols = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
        const col = newCols.find((c) => c.id === sourceColumn.id)!;
        const [movedTask] = col.tasks.splice(activeIndex, 1);
        col.tasks.splice(overIndex, 0, movedTask);
        return newCols;
      });
    }
  }
  
  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const sourceColumn = columns.find((c) =>
      c.tasks.some((t) => t.id === taskId)
    );
    const targetColumn = columns.find(
      (c) => c.id === over.id || c.tasks.some((t) => t.id === over.id)
    );
    
    if (!sourceColumn || !targetColumn) return;
    
    const disallowedMove =
      targetColumn.title === "To Do" &&
      ["In Progress", "Review", "Done"].includes(sourceColumn.title);
    if (disallowedMove) {
        console.warn(`Tasks in '${sourceColumn.title}' cannot be moved back to 'To Do'`);
        return;
    }
    
    const task = columns.flatMap(c => c.tasks).find(t => t.id === taskId);
    let newIndex = targetColumn.tasks.findIndex((t) => t.id === over.id);
    if (newIndex === -1) {
        newIndex = targetColumn.tasks.length;
    }

    if (
      sourceColumn.id !== targetColumn.id ||
      sourceColumn.tasks.findIndex((t) => t.id === taskId) !== newIndex
    ) {
        await moveTask(taskId, targetColumn.id, newIndex);

        if (task && task.reminder !== "none") {
            let newNextReminderAt: string | null | undefined = undefined;

            if (
              ["To Do", "In Progress"].includes(targetColumn.title) &&
              !["To Do", "In Progress"].includes(sourceColumn.title)
            ) {
                const nextTime = new Date();
                nextTime.setMinutes(nextTime.getMinutes() + 1);
                newNextReminderAt = nextTime.toISOString();
            } else if (
              ["Review", "Done"].includes(targetColumn.title) &&
              !["Review", "Done"].includes(sourceColumn.title)
            ) {
                newNextReminderAt = null;
            }

            if (newNextReminderAt !== undefined) {
                await updateTask(taskId, { next_reminder_at: newNextReminderAt });
            }
        }
    }
  }

  async function handleUpdateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !board) return;
    await updateBoard(board.id, {
      title: newTitle.trim(),
      color: newColor || board.color,
    });
    setIsEditingTitle(false);
  }

  function handleEditColumn(column: ColumnWithTasks) {
    setEditingColumn(column);
    setEditingColumnTitle(column.title);
    setIsEditingColumn(true);
  }

  async function handleUpdateColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!editingColumn || !editingColumnTitle.trim()) return;
    await updateColumn(editingColumn.id, editingColumnTitle.trim());
    setIsEditingColumn(false);
  }

  async function handleCreateColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    await createColumn(newColumnTitle.trim());
    setNewColumnTitle("");
    setIsCreatingColumn(false);
  }

  // --- Filtering Logic ---
  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task) => {
      // Priority filter
      if (
        filters.priority.length > 0 &&
        !filters.priority.includes(task.priority)
      ) {
        return false;
      }
  
      // Due date filter
      if (filters.dueDate && task.due_date) {
        const taskDate = new Date(task.due_date).toDateString();
        const filterDate = new Date(filters.dueDate).toDateString();
        if (taskDate !== filterDate) {
          return false;
        }
      } else if (filters.dueDate && !task.due_date) {
        return false;
      }
  
      return true;
    }),
  }));

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const filterCount =
    filters.priority.length + (filters.dueDate ? 1 : 0);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Navbar
          boardTitle={board?.title}
          onEditBoard={() => {
            setNewTitle(board?.title || "");
            setNewColor(board?.color || "");
            setIsEditingTitle(true);
          }}
          onFilterClick={() => setIsFilterOpen(true)}
          filterCount={filterCount}
        />

        <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
            <div className="mb-6">
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Total Tasks: </span>
                    {totalTasks}
                </div>
            </div>
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-col lg:flex-row lg:space-x-6 lg:overflow-x-auto lg:pb-6">
              {filteredColumns.map((column) => (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  onCreateTask={handleCreateTask}
                  onEditColumn={handleEditColumn}
                >
                  <SortableContext
                    items={column.tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {column.tasks.map((task) => (
                        <SortableTask
                          key={task.id}
                          task={task}
                          isAdmin={isAdmin}
                          onEdit={handleOpenEditModal}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              ))}
              <div className="w-full lg:flex-shrink-0 lg:w-80">
                <Button
                  variant="outline"
                  className="w-full h-full min-h-[100px] border-dashed"
                  onClick={() => setIsCreatingColumn(true)}
                >
                  <Plus /> Add another list
                </Button>
              </div>
            </div>
            <DragOverlay>
              {activeTask ? <TaskOverlay task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {/* --- ALL MODALS --- */}

      <Dialog open={isEditingTitle} onOpenChange={setIsEditingTitle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Board</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBoard} className="space-y-4">
            <div>
              <Label>Board Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Board Color</Label>
              <div className="grid grid-cols-6 gap-2 pt-2">
                {[
                  "bg-blue-500", "bg-green-500", "bg-yellow-500",
                  "bg-red-500", "bg-purple-500", "bg-pink-500",
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${
                      newColor === color ? "ring-2 ring-offset-2 ring-black" : ""
                    }`}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditingTitle(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
          <DialogHeader>
            <DialogTitle>Filter Tasks</DialogTitle>
            <p className="text-sm text-gray-600">
              Filter tasks by priority, or due date
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="flex flex-wrap gap-2">
                {["low", "medium", "high"].map((priority) => (
                  <Button
                    onClick={() => {
                      const newPriorities = filters.priority.includes(priority)
                        ? filters.priority.filter((p) => p !== priority)
                        : [...filters.priority, priority];
                      handleFilterChange("priority", newPriorities);
                    }}
                    key={priority}
                    variant={
                      filters.priority.includes(priority) ? "default" : "outline"
                    }
                    size="sm"
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={filters.dueDate || ""}
                onChange={(e) =>
                  handleFilterChange("dueDate", e.target.value || null)
                }
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant={"outline"}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
              <Button type="button" onClick={() => setIsFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingColumn} onOpenChange={setIsCreatingColumn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Column</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateColumn} className="space-y-4">
            <div>
              <Label>Column Title</Label>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreatingColumn(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingColumn} onOpenChange={setIsEditingColumn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateColumn} className="space-y-4">
            <div>
              <Label>Column Title</Label>
              <Input
                value={editingColumnTitle}
                onChange={(e) => setEditingColumnTitle(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingColumn(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingTask} onOpenChange={setIsEditingTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {taskToEdit && (
            <form className="space-y-4" onSubmit={handleUpdateTask}>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input name="title" defaultValue={taskToEdit.title} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  name="description"
                  defaultValue={taskToEdit.description || ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Assignee Email</Label>
                <Input
                  name="assignee"
                  type="email"
                  defaultValue={taskToEdit.assignee || ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  name="dueDate"
                  type="date"
                  defaultValue={taskToEdit.due_date || ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select name="priority" defaultValue={taskToEdit.priority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reminder</Label>
                <Select
                  name="reminder"
                  defaultValue={taskToEdit.reminder || "none"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="15 min">15 min</SelectItem>
                    <SelectItem value="1 hour">1 hour</SelectItem>
                    <SelectItem value="3 hour">3 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                {/* Task History Section */}
                <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2">History</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {taskHistory.length > 0 ? (
                            taskHistory.map((entry) => (
                                <div key={entry.id} className="text-xs text-gray-500">
                                    <p>
                                        <span className="font-medium">{entry.changed_by || 'System'}</span>: {entry.change_description}
                                    </p>
                                    <p className="text-gray-400">
                                        {new Date(entry.changed_at).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500">No history for this task yet.</p>
                        )}
                    </div>
                </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingTask(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

