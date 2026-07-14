import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ai", "0004_flashcarddeck_error_code_flashcarddeck_error_message_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AITokenCalibration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(max_length=64)),
                ("model", models.CharField(max_length=160)),
                ("operation", models.CharField(max_length=64)),
                ("prompt_version", models.CharField(max_length=64)),
                ("sample_count", models.PositiveIntegerField(default=0)),
                ("p95_ratio", models.FloatField(default=1.0)),
                ("fixed_overhead_tokens", models.PositiveIntegerField(default=0)),
                ("window_size", models.PositiveIntegerField(default=200)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="AIRequestUsage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("job_id", models.CharField(blank=True, max_length=100)),
                ("chunk_id", models.CharField(blank=True, max_length=100)),
                ("provider", models.CharField(max_length=64)),
                ("model", models.CharField(max_length=160)),
                ("operation", models.CharField(max_length=64)),
                ("prompt_version", models.CharField(max_length=64)),
                ("payload_hash", models.CharField(max_length=64)),
                ("tokenizer_name", models.CharField(max_length=200)),
                ("local_prompt_tokens", models.PositiveIntegerField(default=0)),
                ("calibration_ratio", models.FloatField(default=1.0)),
                ("fixed_overhead_tokens", models.PositiveIntegerField(default=0)),
                ("calibrated_prompt_tokens", models.PositiveIntegerField(default=0)),
                ("reserved_output_tokens", models.PositiveIntegerField(default=0)),
                ("estimated_total_tokens", models.PositiveIntegerField(default=0)),
                ("actual_prompt_tokens", models.PositiveIntegerField(blank=True, null=True)),
                ("actual_completion_tokens", models.PositiveIntegerField(blank=True, null=True)),
                ("actual_total_tokens", models.PositiveIntegerField(blank=True, null=True)),
                ("ratio", models.FloatField(blank=True, null=True)),
                ("difference_tokens", models.IntegerField(blank=True, null=True)),
                ("status", models.CharField(choices=[("started", "Started"), ("completed", "Completed"), ("failed", "Failed"), ("rejected", "Rejected")], default="started", max_length=16)),
                ("attempt", models.PositiveSmallIntegerField(default=1)),
                ("provider_request_id", models.CharField(blank=True, max_length=160)),
                ("error_code", models.CharField(blank=True, max_length=64)),
                ("request_started_at", models.DateTimeField(blank=True, null=True)),
                ("request_completed_at", models.DateTimeField(blank=True, null=True)),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_request_usages", to="ai.studydocument")),
            ],
        ),
        migrations.CreateModel(
            name="AITokenCalibrationSample",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("local_prompt_tokens", models.PositiveIntegerField()),
                ("actual_prompt_tokens", models.PositiveIntegerField()),
                ("ratio", models.FloatField()),
                ("difference_tokens", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("calibration", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="samples", to="ai.aitokencalibration")),
                ("usage", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="calibration_sample", to="ai.airequestusage")),
            ],
        ),
        migrations.AddConstraint(
            model_name="aitokencalibration",
            constraint=models.UniqueConstraint(fields=("provider", "model", "operation", "prompt_version"), name="unique_ai_token_calibration_scope"),
        ),
        migrations.AddIndex(
            model_name="aitokencalibration",
            index=models.Index(fields=["provider", "model", "operation", "prompt_version"], name="ai_aitokenc_provide_5586bd_idx"),
        ),
        migrations.AddIndex(
            model_name="airequestusage",
            index=models.Index(fields=["provider", "model", "operation", "prompt_version", "created_at"], name="ai_aireques_provide_7a8daf_idx"),
        ),
        migrations.AddIndex(
            model_name="airequestusage",
            index=models.Index(fields=["job_id", "created_at"], name="ai_aireques_job_id_5d545b_idx"),
        ),
        migrations.AddIndex(
            model_name="airequestusage",
            index=models.Index(fields=["document", "created_at"], name="ai_aireques_documen_6d2d07_idx"),
        ),
        migrations.AddIndex(
            model_name="airequestusage",
            index=models.Index(fields=["status"], name="ai_aireques_status_f3ff1a_idx"),
        ),
        migrations.AddIndex(
            model_name="aitokencalibrationsample",
            index=models.Index(fields=["calibration", "created_at"], name="ai_aitokenc_calibra_49608a_idx"),
        ),
    ]
