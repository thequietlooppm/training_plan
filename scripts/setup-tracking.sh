#!/usr/bin/env bash
# One-time setup: labels + a project board for this repo.
#
# Requires: gh CLI installed and authenticated with the "project" scope:
#   gh auth login
#   gh auth refresh -s project
#
# Run this from inside your repo (after `gh repo create` / `git remote add`).

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=$(gh repo view --json owner -q .owner.login)

echo "Creating labels on $REPO..."
gh label create "area:design"   --color "E99695" --description "Design work" --force
gh label create "area:data-eng" --color "0E8A16" --description "Data engineering work" --force
gh label create "area:data-sci" --color "1D76DB" --description "Data science work" --force
gh label create "area:swe"      --color "5319E7" --description "Software engineering work" --force
gh label create "area:deploy"   --color "C2E0C6" --description "Deploy / release engineering work" --force
gh label create "type:feature"  --color "A2EEEF" --description "New feature" --force
gh label create "type:bug"      --color "D73A4A" --description "Bug" --force
gh label create "type:chore"    --color "FEF2C0" --description "Chore / maintenance" --force
gh label create "priority:p0"   --color "B60205" --description "Urgent" --force
gh label create "priority:p1"   --color "D93F0B" --description "High" --force
gh label create "priority:p2"   --color "FBCA04" --description "Normal" --force
gh label create "platform:web"     --color "0052CC" --description "Web app" --force
gh label create "platform:ios"     --color "5319E7" --description "Native iOS app" --force
gh label create "platform:android" --color "0E8A16" --description "Native Android app" --force
gh label create "platform:shared"  --color "BFD4F2" --description "Shared across platforms (packages/)" --force
gh label create "epic"             --color "3E4B9E" --description "Tracking issue linking child issues" --force
gh label create "needs:plan"       --color "D4C5F9" --description "Scoped by tpm, awaiting tech-lead plan" --force

echo "Creating project board..."
gh project create --owner "$OWNER" --title "$(basename "$REPO") Roadmap"

echo ""
echo "Board created. Open it in the browser and edit the default 'Status' field"
echo "to have these options: Backlog, Ready, In Progress, In Review, Done."
echo "(gh project field-create would add a NEW field rather than edit the built-in"
echo "Status field, so it's cleaner to make this one edit in the UI.)"
