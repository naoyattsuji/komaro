-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "edit_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "table_type" TEXT NOT NULL,
    "row_labels" TEXT NOT NULL,
    "col_labels" TEXT NOT NULL,
    "row_meta" TEXT,
    "col_meta" TEXT,
    "max_participants" INTEGER NOT NULL DEFAULT 50,
    "password_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_cells" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "col_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "author_name" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_edit_token_key" ON "events"("edit_token");

-- CreateIndex
CREATE INDEX "availability_cells_event_id_row_index_col_index_idx" ON "availability_cells"("event_id", "row_index", "col_index");

-- CreateIndex
CREATE UNIQUE INDEX "availability_cells_participant_id_row_index_col_index_key" ON "availability_cells"("participant_id", "row_index", "col_index");

-- CreateIndex
CREATE UNIQUE INDEX "login_attempts_event_id_ip_address_key" ON "login_attempts"("event_id", "ip_address");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_cells" ADD CONSTRAINT "availability_cells_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
