# Vriksh Cloud Runtime

> **The Self-Hosted Execution Engine for Vriksh Labs.**

The **Vriksh Cloud Runtime** (`@vriksh/cloud-runtime`) is a standalone CLI tool designed to provision, orchestrate, and score complex technical labs on your local machine. It reads a **Lab Spec v2.0** YAML file and brings up real infrastructure using **Docker** or **Kubernetes**, without requiring an external control plane, SaaS accounts, or internet dependencies (beyond fetching images).

---

## Why Vriksh Runtime?

*   **Local-First:** No cloud bills, no multi-tenancy, no latency. Everything runs on your localhost.
*   **Real Infrastructure:** Provisions actual instances of GitLab, Kafka, Postgres, or K8s clusters—not mocks.
*   **Automated Lifecycle:** Manages the entire flow: Validation → Provisioning → Readiness → Scoring → Teardown.
*   **Extensible:** Uses a plugin architecture to support various providers (`@vriksh/provider-*`).
*   **Scoring Engine:** Built-in automated checks to verify lab completion and generate learning reports.

---

## Installation

Ensure you have **Node.js 18+ (LTS)** and **Docker Desktop/Engine** installed.

```bash
npm install -g @vriksh/cloud-runtime
```

Verify the installation:

```bash
vriksh --version
```

---

## Quick Start

1.  **Explore Examples:**
    Check out the `examples/` directory for reference Lab Specifications.

    ```bash
    # Navigate to the examples directory
    cd examples/gitlab
    ```

2.  **Run a Lab:**
    Execute the lab definition. The CLI will handle network creation, container provisioning, and health checks.

    ```bash
    vriksh run gitlab-ci-basics.yaml
    ```

3.  **Interact:**
    Follow the on-screen instructions to access services (e.g., `http://localhost:8923`) and perform tasks.

4.  **Score & Teardown:**
    When finished, the CLI runs verification checks, generates a report, and cleanly destroys all resources.

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `vriksh run <lab.yml>` | Execute a lab end-to-end locally. |
| `vriksh validate <lab.yml>` | Validate a Lab YAML file against the v2 schema. |
| `vriksh logs` | Show or tail logs for the active or last run. |
| `vriksh teardown` | Force destroy resources for the last run. |
| `vriksh init-provider <name>` | Scaffold local configuration for a specific provider. |

---

## Architecture

The runtime operates as a deterministic **Finite State Machine (FSM)**:

`PARSING` → `VALIDATION` → `PREPARE` → `PROVISION` → `INIT` → `READY` → `RUN` → `SCORING` → `TEARDOWN`

It manages local state in `~/.vriksh/state.sqlite` and isolates every run in its own Docker network or Kubernetes namespace.

For a deep dive into the system architecture, internals, and provider logic, read the **[System Design Document](docs/system-design.md)**.

### Execution Backends
*   **Docker (Default):** Uses Docker Compose-style logic to manage containers.
*   **Kubernetes:** (Optional) Delegates to a local cluster (kind/k3d) via `kubectl`.

---

## System Requirements

| Component | Minimum | Recommended (Multi-Provider) |
| :--- | :--- | :--- |
| **OS** | macOS, Linux, WSL2 | macOS, Linux |
| **RAM** | 8 GB | 16–32 GB |
| **CPU** | 4 cores | 8 cores |
| **Disk** | 20 GB free | 100+ GB NVMe |
| **Runtime** | Node.js 18+ | Node.js 20+ |

---

## Directory Structure

*   **User Labs:** Your project folder containing `lab.yml`, scripts, and assets.
*   **Runtime Data (`~/.vriksh/`):**
    *   `state.sqlite`: Persistent state of runs and scores.
    *   `logs/`: Detailed execution logs for debugging.
    *   `providers/`: Local provider plugins.

---

## License

© 2025 Vriksh Cloud