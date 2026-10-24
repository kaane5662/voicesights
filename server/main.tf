
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "api_image" {
  type        = string
  description = "Artifact Registry URL for the VoiceSights API image"
}
variable "celery_image" {
  type        = string
  description = "Artifact Registry URL for the VoiceSights Celeru image"
}

resource "google_cloud_run_v2_service" "voicesights_api" {
  name                = "voicesights-api"
  location            = var.region
  deletion_protection = false

  scaling {
    min_instance_count = 0
    max_instance_count = 1
  }

  template {
    containers {
      image = var.api_image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 1
    }
  }
}

resource "google_cloud_run_v2_job" "voicesights_celery_worker" {
  name     = "voicesights-celery-worker"
  location = var.region
  deletion_protection = false

  template {
    template {
      containers {
        image = var.celery_image

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        # Provide entrypoint if needed for celery worker
        command = ["celery", "-A", "app.celery", "worker", "--loglevel=info"]
      }
      max_retries      = 3
      timeout          = "3600s"
      service_account  = null # Specify if needed
    }
  }

  # Optionally configure recurring execution schedules via a scheduler (not in Cloud Run Job itself)
}

output "api_url" {
  value = google_cloud_run_v2_service.voicesights_api.uri
}
# Output the fully qualified resource name (FQRN) of the Cloud Run Job for the worker
output "celery_worker_fqrn" {
  value = google_cloud_run_v2_job.voicesights_celery_worker.name
}
