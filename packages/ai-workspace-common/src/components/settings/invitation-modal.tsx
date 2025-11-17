import { Button, Input, Modal, message } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { InvitationCode } from '@refly/openapi-schema';
import { useUserStoreShallow } from '@refly/stores';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';

const INVITATION_CODE_LENGTH = 6;

interface InvitationModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // Invitation codes state
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);

  // Invitation code activation state
  const [activationCode, setActivationCode] = useState('');
  const [activatingCode, setActivatingCode] = useState(false);

  // Generate invitation codes
  const handleGenerateInvitationCodes = async () => {
    if (generatingCodes) return;
    setGeneratingCodes(true);
    try {
      const { error } = await getClient().generateInvitationCode();
      if (error) {
        message.error(t('settings.account.generateInvitationCodeFailed'));
        return;
      }
      message.success(t('settings.account.generateInvitationCodeSuccess'));
      // Refresh the invitation codes list
      await fetchInvitationCodes();
    } catch (error) {
      console.error('Error generating invitation codes:', error);
      message.error(t('settings.account.generateInvitationCodeFailed'));
    } finally {
      setGeneratingCodes(false);
    }
  };

  // Fetch invitation codes
  const fetchInvitationCodes = async () => {
    if (loadingCodes) return;
    setLoadingCodes(true);
    try {
      const { data, error } = await getClient().listInvitationCodes();
      if (error) {
        console.error('Error fetching invitation codes:', error);
        return;
      }
      if (data?.data) {
        setInvitationCodes(data.data);
      }
    } catch (error) {
      console.error('Error fetching invitation codes:', error);
    } finally {
      setLoadingCodes(false);
    }
  };

  // Activate invitation code
  const handleActivateInvitationCode = async () => {
    if (activatingCode || !activationCode.trim()) return;

    setActivatingCode(true);
    try {
      const { error } = await getClient().activateInvitationCode({
        body: { code: activationCode.trim() },
      });

      if (error) {
        message.error(t('settings.account.activateInvitationCodeFailed'));
        return;
      }

      message.success(t('settings.account.activateInvitationCodeSuccess'));
      setActivationCode(''); // Clear input after success
    } catch (error) {
      console.error('Error activating invitation code:', error);
      message.error(t('settings.account.activateInvitationCodeFailed'));
    } finally {
      setActivatingCode(false);
    }
  };

  // Copy invitation code to clipboard
  const handleCopyInvitationCode = async (invitationCode: string) => {
    try {
      await navigator.clipboard.writeText(invitationCode);
      message.success(t('settings.account.invitationCodeCopied'));
    } catch (error) {
      console.error('Failed to copy invitation code:', error);
      message.error(t('settings.account.invitationCodeCopyFailed'));
    }
  };

  // Join Discord community
  const handleJoinDiscord = () => {
    window.open('https://discord.gg/bWjffrb89h', '_blank');
  };

  // Load invitation codes when modal opens
  useEffect(() => {
    if (visible && userProfile?.uid) {
      fetchInvitationCodes();
    }
  }, [visible, userProfile?.uid]);

  return (
    <Modal open={visible} onCancel={() => setVisible(false)} footer={null} width={421} centered>
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-4">
          {/* Activate Invitation Code */}
          <div className="flex justify-center">
            <div style={{ width: 308, height: 68 }}>
              <Input.OTP
                length={INVITATION_CODE_LENGTH}
                value={activationCode}
                onChange={(value) => setActivationCode(value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleActivateInvitationCode();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-center">
            <Button
              type="primary"
              onClick={handleActivateInvitationCode}
              loading={activatingCode}
              disabled={
                activatingCode || (activationCode ?? '').trim().length < INVITATION_CODE_LENGTH
              }
              style={{ width: 308, height: 36 }}
            >
              <div className="flex items-center gap-1">
                <IconLightning01 className="w-4 h-4" />
                {activatingCode
                  ? t('common.activating')
                  : t('settings.account.activateInvitationCode')}
              </div>
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              type="text"
              size="middle"
              className="text-sm text-refly-text-0 font-semibold bg-refly-tertiary-default hover:bg-refly-tertiary-hover"
              onClick={handleJoinDiscord}
              style={{ width: 308, height: 36 }}
            >
              {t('common.joinDiscord')}
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              type="primary"
              onClick={handleGenerateInvitationCodes}
              loading={generatingCodes}
              disabled={generatingCodes}
              style={{ width: 308, height: 36 }}
            >
              <IconLightning01 className="w-4 h-4" />
              {generatingCodes
                ? t('common.generating')
                : t('settings.account.generateInvitationCodes')}
            </Button>
          </div>

          {invitationCodes.length > 0 ? (
            <div className="space-y-2">
              {invitationCodes.map((code, index) => (
                <div
                  key={code.code || index}
                  className={`p-3 rounded-lg border ${
                    code.status === 'pending'
                      ? 'bg-green-50 border-green-200 cursor-pointer hover:bg-green-100 transition-colors'
                      : code.status === 'accepted'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-refly-bg-control-z1 border-refly-border-primary'
                  }`}
                  onClick={() =>
                    code.status === 'pending' && handleCopyInvitationCode(code.code || '')
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="font-mono text-sm font-semibold text-refly-text-0">
                        {code.code}
                      </div>
                      <div className="text-xs text-refly-text-1">
                        {t('settings.account.expiresAt')}:{' '}
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded-full text-center min-w-[60px] ${
                        code.status === 'pending'
                          ? 'bg-green-100 text-green-800'
                          : code.status === 'accepted'
                            ? 'bg-gray-100 text-gray-600'
                            : 'text-refly-text-1'
                      }`}
                    >
                      {code.status === 'pending'
                        ? t('settings.account.statusPending')
                        : code.status === 'accepted'
                          ? t('settings.account.statusUsed')
                          : code.status || 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-refly-text-1 py-4">
              {t('settings.account.noInvitationCodes')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
