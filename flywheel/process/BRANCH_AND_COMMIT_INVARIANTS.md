# Branch And Commit Invariants

- stage launch requires the configured branch
- intermediate stage transitions do not create commits
- each completed cycle creates exactly one commit
- cycle commit format is controlled by `workflow.cycle_commit_format`
- observer output belongs to the same cycle closure as the final commit
