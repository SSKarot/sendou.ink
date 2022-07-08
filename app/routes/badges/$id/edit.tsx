import * as React from "react";
import { Form, useMatches, useOutletContext } from "@remix-run/react";
import { Button, LinkButton } from "~/components/Button";
import { Dialog } from "~/components/Dialog";
import { atOrError } from "~/utils/arrays";
import type { BadgeDetailsContext, BadgeDetailsLoaderData } from "../$id";
import { discordFullName } from "~/utils/strings";
import { UserCombobox } from "~/components/Combobox";
import { TrashIcon } from "~/components/icons/Trash";
import { z } from "zod";
import { actualNumber, noDuplicates, safeJSONParse, id } from "~/utils/zod";
import type { ActionFunction } from "@remix-run/node";
import { requireUser, useUser } from "~/modules/auth";
import { parseRequestFormData, validate } from "~/utils/remix";
import { canEditBadgeManagers, canEditBadgeOwners } from "~/permissions";
import { assertUnreachable } from "~/utils/types";
import { db } from "~/db";
import type { User } from "~/db/types";

const editBadgeActionSchema = z.union([
  z.object({
    _action: z.literal("MANAGERS"),
    managerIds: z.preprocess(safeJSONParse, z.array(id).refine(noDuplicates)),
  }),
  z.object({
    _action: z.literal("OWNERS"),
    ownerIds: z.preprocess(safeJSONParse, z.array(id)),
  }),
]);

export const action: ActionFunction = async ({ request, params }) => {
  const data = await parseRequestFormData({
    request,
    schema: editBadgeActionSchema,
  });
  const badgeId = z.preprocess(actualNumber, z.number()).parse(params["id"]);
  const user = await requireUser(request);

  switch (data._action) {
    case "MANAGERS": {
      validate(canEditBadgeManagers(user));

      db.badges.upsertManyManagers({ badgeId, managerIds: data.managerIds });
      break;
    }
    case "OWNERS": {
      validate(
        canEditBadgeOwners({
          user,
          managers: db.badges.managersByBadgeId(badgeId),
        })
      );

      db.badges.upsertManyOwners({ badgeId, ownerIds: data.ownerIds });
      break;
    }
    default: {
      assertUnreachable(data);
    }
  }

  return null;
};

export default function EditBadgePage() {
  const user = useUser();
  const matches = useMatches();
  const data = atOrError(matches, -2).data as BadgeDetailsLoaderData;
  const { badgeName } = useOutletContext<BadgeDetailsContext>();

  return (
    <Dialog isOpen className="stack md">
      <Form method="post">
        <div>
          <h2 className="badges-edit__big-header">
            Editing winners of {badgeName}
          </h2>
          <LinkButton
            to={atOrError(matches, -2).pathname}
            variant="minimal-destructive"
            tiny
            className="badges-edit__cancel-button"
          >
            Cancel
          </LinkButton>
        </div>

        {canEditBadgeManagers(user) ? <Managers data={data} /> : null}
        <Owners data={data} />
      </Form>
    </Dialog>
  );
}

function submitButtonText(amountOfChanges: number) {
  if (amountOfChanges === 0) return "Submit";
  if (amountOfChanges === 1) return `Submit ${amountOfChanges} change`;

  return `Submit ${amountOfChanges} changes`;
}

function Managers({ data }: { data: BadgeDetailsLoaderData }) {
  const [managers, setManagers] = React.useState(
    data.managers.map((m) => ({
      id: m.id,
      discordFullName: discordFullName(m),
    }))
  );

  const amountOfChanges = managers
    .filter((m) => !data.managers.some((om) => om.id === m.id))
    // maps to id to keep typescript happy
    .map((m) => m.id)
    // needed so we can also list amount of removed managers
    .concat(
      data.managers
        .filter((om) => !managers.some((m) => m.id === om.id))
        .map((m) => m.id)
    ).length;

  return (
    <div className="stack md">
      <div className="stack sm">
        <h3 className="badges-edit__small-header">Managers</h3>
        <ul className="badges-edit__users-list">
          {managers.map((manager) => (
            <li key={manager.id} data-cy="manager">
              {manager.discordFullName}
              <Button
                icon={<TrashIcon />}
                variant="minimal-destructive"
                aria-label="Delete badge manager"
                onClick={() =>
                  setManagers(managers.filter((m) => m.id !== manager.id))
                }
                data-cy="delete-manager-button"
              />
            </li>
          ))}
        </ul>
        <UserCombobox
          className="mx-auto"
          inputName="new-manager"
          onChange={(user) => {
            if (!user) return;

            setManagers([
              ...managers,
              { discordFullName: user.label, id: Number(user.value) },
            ]);
          }}
          userIdsToOmit={new Set(managers.map((m) => m.id))}
        />
      </div>
      <input
        type="hidden"
        name="managerIds"
        value={JSON.stringify(managers.map((m) => m.id))}
      />
      <Button
        type="submit"
        tiny
        className="badges-edit__submit-button"
        disabled={amountOfChanges === 0}
        name="_action"
        value="MANAGERS"
      >
        {submitButtonText(amountOfChanges)}
      </Button>
    </div>
  );
}

function Owners({ data }: { data: BadgeDetailsLoaderData }) {
  const [owners, setOwners] = React.useState(
    data.owners.map((o) => ({
      id: o.id,
      discordFullName: discordFullName(o),
      count: o.count,
    }))
  );

  const amountOfChanges = owners.reduce((acc, owner) => {
    const oldOwner = data.owners.find((o) => o.id === owner.id);
    const hasChanged = !oldOwner || owner.count !== oldOwner.count;
    return acc + (hasChanged ? 1 : 0);
  }, 0);

  return (
    <div className="stack md">
      <div className="stack sm">
        <h3 className="badges-edit__small-header">Owners</h3>
        <ul className="badges-edit__users-list">
          {owners.map((owner) => (
            <li key={owner.id}>
              {owner.discordFullName}
              <input
                className="badges-edit__number-input"
                data-cy="owner-count-input"
                id="number"
                type="number"
                value={owner.count}
                min={0}
                max={100}
                onChange={(e) =>
                  setOwners(
                    owners.map((o) =>
                      o.id === owner.id
                        ? { ...o, count: Number(e.target.value) }
                        : o
                    )
                  )
                }
              />
            </li>
          ))}
        </ul>
        <UserCombobox
          className="mx-auto"
          inputName="new-owner"
          onChange={(user) => {
            if (!user) return;

            setOwners([
              ...owners,
              { discordFullName: user.label, id: Number(user.value), count: 1 },
            ]);
          }}
          userIdsToOmit={new Set(owners.map((m) => m.id))}
        />
      </div>
      <input
        type="hidden"
        name="ownerIds"
        value={JSON.stringify(countArrayToDuplicatedIdsArray(owners))}
      />
      <Button
        type="submit"
        tiny
        className="badges-edit__submit-button"
        disabled={amountOfChanges === 0}
        name="_action"
        value="OWNERS"
      >
        {submitButtonText(amountOfChanges)}
      </Button>
    </div>
  );
}

function countArrayToDuplicatedIdsArray(
  owners: Array<{ id: User["id"]; count: number }>
) {
  return owners.flatMap((o) => new Array(o.count).fill(null).map(() => o.id));
}