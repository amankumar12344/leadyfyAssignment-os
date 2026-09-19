const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { requireAuth } = require('../middleware/auth');
const { blockClientFromInternal } = require('../middleware/isolation');

router.use(requireAuth);
router.use(blockClientFromInternal); // Tasks are internal to agency employees

router.get('/', async (req, res) => {
  try {
    const tasks = await taskService.listTasks(req.query);
    return res.json({ success: true, tasks });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user.id);
    return res.status(201).json({ success: true, task });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const updated = await taskService.updateTask(taskId, req.body, req.user.id);
    return res.json({ success: true, task: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
