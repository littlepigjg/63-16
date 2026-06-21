import { Router } from 'express';
import { configService } from '../services/ConfigService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const projects = await configService.getAllProjects();
    res.json({ success: true, data: projects });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

router.get('/trees', async (req, res) => {
  try {
    const trees = await configService.getAllInheritanceTrees();
    res.json({ success: true, data: trees });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch inheritance trees' });
  }
});

router.get('/:projectId', async (req, res) => {
  try {
    const project = await configService.getProjectById(req.params.projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data: project });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

router.get('/:projectId/resolved', async (req, res) => {
  try {
    const resolved = await configService.getResolvedProject(req.params.projectId);
    if (!resolved) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data: resolved });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch resolved project' });
  }
});

router.get('/:projectId/inheritance', async (req, res) => {
  try {
    const info = await configService.getInheritanceInfo(req.params.projectId);
    if (!info) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data: info });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch inheritance info' });
  }
});

router.get('/:projectId/change-hints', async (req, res) => {
  try {
    const env = typeof req.query.env === 'string' ? req.query.env : undefined;
    const hints = await configService.getChangeHints(req.params.projectId, env);
    res.json({ success: true, data: hints });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch change hints' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, parentId } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Project name is required' });
      return;
    }
    const project = await configService.createProject(
      name,
      description || '',
      parentId !== undefined ? (parentId as string | null) : undefined
    );
    if ('error' in project) {
      res.status(400).json({ success: false, error: project.error });
      return;
    }
    res.status(201).json({ success: true, data: project });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

router.put('/:projectId', async (req, res) => {
  try {
    const result = await configService.updateProject(req.params.projectId, req.body);
    if (!result) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    if ('error' in result) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

router.delete('/:projectId', async (req, res) => {
  try {
    const deleted = await configService.deleteProject(req.params.projectId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

export default router;
