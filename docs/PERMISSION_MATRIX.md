# Permission matrix

Roles are bundles of permission keys. The API checks the key, not the role name.

| Permission | super_admin | operations_admin | academic_admin | content_editor | reviewer_publisher | auditor |
|---|---|---|---|---|---|---|
| users.read | yes | yes | yes | | | yes |
| users.update | yes | yes | | | | |
| users.suspend | yes | yes | | | | |
| users.export | yes | yes | | | | |
| enrollments.create | yes | yes | yes | | | |
| enrollments.revoke | yes | yes | yes | | | |
| content.create | yes | | yes | yes | | |
| content.edit | yes | | yes | yes | | |
| content.review | yes | | yes | | yes | |
| content.publish | yes | | yes | | yes | |
| content.archive | yes | | yes | | yes | |
| explore.manage | yes | yes | | yes | yes | |
| banners.manage | yes | yes | | yes | yes | |
| assessments.author | yes | | yes | | | |
| assessments.publish | yes | | yes | | | |
| results.read | yes | yes | yes | | | yes |
| results.recompute | yes | | yes | | | |
| results.publish | yes | | yes | | | |
| semester.review | yes | yes | yes | | | |
| semester.approve | yes | | yes | | | |
| documents.generate | yes | yes | | | | |
| documents.issue | yes | | | | | |
| documents.revoke | yes | | | | | |
| live.schedule | yes | yes | | | | |
| notifications.send_single | yes | yes | yes | | | |
| notifications.send_bulk | yes | | | | | |
| payments.read | yes | yes | | | | yes |
| payments.refund_approve | yes | | | | | |
| settings.manage | yes | | | | | |
| admins.manage | yes | | | | | |
| audit.read | yes | yes | | | | yes |
| reports.read | yes | yes | yes | | | yes |

Source of truth: `apps/api/src/common/permissions/permissions.ts`. The seeded `super_admin` account holds every key.
