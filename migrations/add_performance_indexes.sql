-- Performance indexes for AccKPI
-- Run once on AccDBF database
-- These cover the most frequently queried columns across all API routes

USE [AccDBF]
GO

-- tblTasks: heavily queried by WorkFlowHdrID, DepId, proccessID, IsTaskSelected, Priority
CREATE NONCLUSTERED INDEX IX_tblTasks_WorkFlowHdrID
ON tblTasks (WorkFlowHdrID)
INCLUDE (TaskName, DepId, Priority, IsTaskSelected, PlannedDate, DaysRequired);
GO

CREATE NONCLUSTERED INDEX IX_tblTasks_DepId_Priority
ON tblTasks (DepId, Priority)
INCLUDE (TaskID, TaskName, IsTaskSelected, WorkFlowHdrID);
GO

CREATE NONCLUSTERED INDEX IX_tblTasks_proccessID
ON tblTasks (proccessID)
INCLUDE (TaskID, TaskName, DepId, Priority, WorkFlowHdrID);
GO

CREATE NONCLUSTERED INDEX IX_tblTasks_linkTasks
ON tblTasks (linkTasks)
WHERE linkTasks IS NOT NULL;
GO

-- tblWorkflowDtl: queried by workFlowHdrId + TaskID on almost every request
CREATE NONCLUSTERED INDEX IX_tblWorkflowDtl_WorkFlowHdrId
ON tblWorkflowDtl (workFlowHdrId)
INCLUDE (TaskID, TimeStarted, TimeFinished, Delay, DelayReason);
GO

CREATE NONCLUSTERED INDEX IX_tblWorkflowDtl_TaskID
ON tblWorkflowDtl (TaskID)
INCLUDE (workFlowHdrId, TimeStarted, TimeFinished);
GO

-- tblWorkflowHdr: queried by processID, projectID, packageID
CREATE NONCLUSTERED INDEX IX_tblWorkflowHdr_processID
ON tblWorkflowHdr (processID)
INCLUDE (projectID, packageID, status, startDate);
GO

CREATE NONCLUSTERED INDEX IX_tblWorkflowHdr_projectID
ON tblWorkflowHdr (projectID)
INCLUDE (processID, status);
GO

-- tblWorkflowSteps: queried by workFlowID + isActive frequently
CREATE NONCLUSTERED INDEX IX_tblWorkflowSteps_WorkFlowID_IsActive
ON tblWorkflowSteps (workFlowID, isActive)
INCLUDE (stepNumber, StepFinished, StepStartDate);
GO

-- tblWorkflowTaskHistory: queried by workFlowID
CREATE NONCLUSTERED INDEX IX_tblWorkflowTaskHistory_WorkFlowID
ON tblWorkflowTaskHistory (workFlowID)
INCLUDE (PaymentStep, TaskID, DepId, TimeFinished);
GO

-- tblProcessDepartment: queried by ProcessID + DepartmentID
CREATE NONCLUSTERED INDEX IX_tblProcessDepartment_ProcessID
ON tblProcessDepartment (ProcessID, DepartmentID)
INCLUDE (StepOrder, IsActive);
GO

-- tblUsers: login queries by email
CREATE NONCLUSTERED INDEX IX_tblUsers_Email
ON tblUsers (usrEmail)
INCLUDE (usrID, usrDesc, DepartmentID, usrAdmin, IsSpecialUser);
GO

PRINT 'All performance indexes created successfully';
GO
