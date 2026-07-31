from datetime import timedelta

# How long a soft-deleted case/evidence row survives before api/worker.py's
# purge sweep physically deletes it (and, for evidence, its file in the
# storage vault). This is the actual "undo window" - the DELETE endpoints
# just set deleted_at; nothing is unrecoverable until this elapses.
SOFT_DELETE_GRACE_PERIOD = timedelta(hours=24)
