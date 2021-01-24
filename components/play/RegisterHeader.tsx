import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  HStack,
  Input,
  useToast,
} from "@chakra-ui/react";
import { t, Trans } from "@lingui/macro";
import UserAvatar from "components/common/UserAvatar";
import { useLadderTeams } from "hooks/play";
import { getToastOptions } from "lib/getToastOptions";
import { sendData } from "lib/postData";
import useUser from "lib/useUser";
import { useState } from "react";
import { FiTrash } from "react-icons/fi";

interface Props {}

const RegisterHeader: React.FC<Props> = ({}) => {
  const toast = useToast();
  const [user] = useUser();
  const { data, mutate } = useLadderTeams();

  const [sending, setSending] = useState(false);

  const createNewTeam = async () => {
    setSending(true);
    const success = await sendData("POST", "/api/play/teams");
    setSending(false);
    if (!success) return;

    mutate();

    toast(getToastOptions(t`Team created`, "success"));
  };

  const deleteTeam = async () => {
    if (!window.confirm(t`Delete registration?`)) return;
    setSending(true);
    const success = await sendData("DELETE", "/api/play/teams");
    setSending(false);
    if (!success) return;

    mutate();

    toast(getToastOptions(t`Registration canceled`, "success"));
  };

  const leaveTeam = async () => {
    if (!window.confirm(t`Leave team?`)) return;
    setSending(true);
    const success = await sendData("POST", "/api/play/teams/leave");
    setSending(false);
    if (!success) return;

    mutate();

    toast(getToastOptions(t`Team left`, "success"));
  };

  if (!user) return null;

  const ownTeam = data?.find((team) =>
    team.roster.some((member) => member.id === user.id)
  );

  const ownTeamFullyRegisted = !!ownTeam && ownTeam.roster.length >= 4;

  return (
    <Box>
      {ownTeam ? (
        <Alert
          status={ownTeamFullyRegisted ? "success" : "warning"}
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          p={6}
          mt={4}
        >
          <AlertTitle mb={1} fontSize="lg">
            {ownTeam.roster.length >= 4 ? (
              <Trans>Team fully registered</Trans>
            ) : (
              <Trans>Add players to complete registration</Trans>
            )}
          </AlertTitle>
          <AlertDescription>
            {ownTeam.inviteCode && (
              <Box>
                <Input
                  name="code"
                  value={`https://sendou.ink/play/join?code=${ownTeam.inviteCode}`}
                  readOnly
                />
              </Box>
            )}
            <HStack my={2} justify="center">
              {ownTeam.roster.map((member) => (
                <UserAvatar user={member} />
              ))}
            </HStack>
            <Box mt={4}>
              {ownTeam.ownerId === user.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<FiTrash />}
                  colorScheme="red"
                  onClick={deleteTeam}
                  isLoading={sending}
                >
                  <Trans>Delete registration</Trans>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  onClick={leaveTeam}
                  isLoading={sending}
                >
                  <Trans>Leave team</Trans>
                </Button>
              )}
            </Box>
          </AlertDescription>
        </Alert>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={createNewTeam}
          isLoading={sending}
        >
          <Trans>Register new team</Trans>
        </Button>
      )}
    </Box>
  );
};

export default RegisterHeader;
