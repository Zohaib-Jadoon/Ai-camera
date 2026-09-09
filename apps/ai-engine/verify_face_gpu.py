"""Verify GPU providers and execute both face model graphs using synthetic inputs."""
import json
import numpy as np
from src.face_engine import FaceEngine


def main():
    engine = FaceEngine()
    if not engine.is_loaded():
        raise RuntimeError('Face engine failed to load')
    providers = {name: model.session.get_providers() for name, model in engine.app.models.items()}
    if not all('CUDAExecutionProvider' in value for value in providers.values()):
        raise RuntimeError(f'GPU provider missing: {providers}')
    engine.process(np.zeros((320, 320, 3), dtype=np.uint8))
    if engine.last_error:
        raise RuntimeError(engine.last_error)
    embedding = engine.app.models['recognition'].get_feat(np.zeros((112, 112, 3), dtype=np.uint8))
    if not np.isfinite(embedding).all():
        raise RuntimeError('Non-finite synthetic embedding')
    print(json.dumps({'providers': providers, 'synthetic_detection_and_embedding': 'passed'}))


if __name__ == '__main__':
    main()
