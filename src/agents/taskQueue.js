const tasks = [];

export function addTask(type, data = {}) {
  if (!type) {
    throw new Error("Task type is required.");
  }

  const task = {
    id: `task_${Date.now()}`,
    type,
    data,
    status: "QUEUED",
    createdAt: new Date().toISOString()
  };

  tasks.push(task);

  return task;
}

export function getTasks(status = null) {
  if (!status) {
    return [...tasks];
  }

  return tasks.filter(
    (task) => task.status === status
  );
}

export function startTask(taskId) {
  const task = tasks.find(
    (item) => item.id === taskId
  );

  if (!task) {
    throw new Error("Task not found.");
  }

  task.status = "PROCESSING";
  task.startedAt = new Date().toISOString();

  return task;
}

export function completeTask(taskId, result = null) {
  const task = tasks.find(
    (item) => item.id === taskId
  );

  if (!task) {
    throw new Error("Task not found.");
  }

  task.status = "COMPLETED";
  task.result = result;
  task.completedAt = new Date().toISOString();

  return task;
}

export function failTask(taskId, error) {
  const task = tasks.find(
    (item) => item.id === taskId
  );

  if (!task) {
    throw new Error("Task not found.");
  }

  task.status = "FAILED";
  task.error = error || "Task failed.";
  task.failedAt = new Date().toISOString();

  return task;
}
