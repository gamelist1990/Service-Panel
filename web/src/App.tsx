import { useState } from "react";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AddGroupModal } from "./components/AddGroupModal";
import { AddServiceModal } from "./components/AddServiceModal";
import { HeaderBar } from "./components/HeaderBar";
import { StatusCards } from "./components/StatusCards";
import { ToastStack } from "./components/ToastStack";
import { usePanelController } from "./hooks/usePanelController";
import { getAccessUuid } from "./lib/auth";
import { EditorPage } from "./pages/EditorPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ServicesPage } from "./pages/ServicesPage";
import type { GroupAction, ServiceAction, ServiceCreatePayload } from "./types";

function AppShell() {
  const uuid = getAccessUuid();
  const navigate = useNavigate();
  const panel = usePanelController(uuid);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  if (!uuid) {
    return (
      <main className="empty-screen">
        UUIDがありません。`/request?uuid=...` でアクセスしてください。
      </main>
    );
  }

  async function safeRun(task: () => Promise<void>) {
    try {
      await task();
    } catch (error) {
      panel.notify(String((error as Error).message ?? error), "error");
    }
  }

  async function onServiceAction(serviceId: string, action: ServiceAction) {
    await safeRun(() => panel.runServiceAction(serviceId, action));
  }

  async function onGroupAction(groupId: string, action: GroupAction) {
    await safeRun(() => panel.runGroupAction(groupId, action));
  }

  async function onOpenJournal(serviceId: string) {
    await safeRun(async () => {
      await panel.openJournal(serviceId);
      navigate("/editor");
    });
  }

  async function onOpenUnitEditor(serviceId: string) {
    await safeRun(async () => {
      await panel.openUnitEditor(serviceId);
      navigate("/editor");
    });
  }

  async function onSaveUnitEditor() {
    await safeRun(() => panel.saveUnitEditor(panel.unitEditor.content));
  }

  async function onAddGroup(name: string) {
    await safeRun(() => panel.addGroup(name));
  }

  async function onAddService(payload: ServiceCreatePayload) {
    await safeRun(() => panel.addService(payload));
  }

  return (
    <div className="app-shell">
      <HeaderBar
        busy={panel.busy}
        onOpenGroupModal={() => setShowGroupModal(true)}
        onOpenServiceModal={() => setShowServiceModal(true)}
        onRefresh={() => {
          void safeRun(panel.refreshAll);
        }}
      />

      <StatusCards status={panel.systemStatus} />

      <Routes>
        <Route
          path="/"
          element={<OverviewPage status={panel.systemStatus} services={panel.services} logs={panel.logs} />}
        />
        <Route
          path="/services"
          element={
            <ServicesPage
              groups={panel.groups}
              groupedServices={panel.groupedServices}
              onDeleteGroup={(id) => safeRun(() => panel.deleteGroup(id))}
              onGroupAction={onGroupAction}
              onAssignGroup={(serviceId, groupId) => safeRun(() => panel.assignGroup(serviceId, groupId))}
              onServiceAction={onServiceAction}
              onOpenJournal={onOpenJournal}
              onOpenUnitEditor={onOpenUnitEditor}
              onDeleteService={(id) => safeRun(() => panel.deleteService(id))}
            />
          }
        />
        <Route
          path="/editor"
          element={
            <EditorPage
              selectedServiceId={panel.selectedServiceId}
              journal={panel.journal}
              logs={panel.logs}
              unitEditor={panel.unitEditor}
              onUnitEditorChange={(next) => panel.setUnitEditor((prev) => ({ ...prev, content: next }))}
              onSaveUnitEditor={onSaveUnitEditor}
              onCloseUnitEditor={panel.closeUnitEditor}
            />
          }
        />
      </Routes>

      <AddGroupModal open={showGroupModal} onClose={() => setShowGroupModal(false)} onSubmit={onAddGroup} />
      <AddServiceModal
        open={showServiceModal}
        groups={panel.groups}
        onClose={() => setShowServiceModal(false)}
        onSubmit={onAddService}
      />
      <ToastStack toasts={panel.toasts} />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

