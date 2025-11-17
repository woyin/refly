import { Button, Input, Modal, message } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { InvitationCode } from '@refly/openapi-schema';
import { useUserStoreShallow } from '@refly/stores';

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

  // Load invitation codes when modal opens
  useEffect(() => {
    if (visible && userProfile?.uid) {
      fetchInvitationCodes();
    }
  }, [visible, userProfile?.uid]);

  return (
    <Modal
      title={t('settings.account.invitationCodes')}
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      width={600}
      centered
    >
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-base text-refly-text-0">
              {t('settings.account.invitationCodes')}
            </div>
            <Button
              type="primary"
              onClick={handleGenerateInvitationCodes}
              loading={generatingCodes}
              disabled={generatingCodes}
            >
              {generatingCodes
                ? t('common.generating')
                : t('settings.account.generateInvitationCodes')}
            </Button>
          </div>

          {/* Activate Invitation Code */}
          <div className="flex gap-2">
            <Input
              placeholder={t('settings.account.enterInvitationCode')}
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              onPressEnter={handleActivateInvitationCode}
              className="flex-1"
            />
            <Button
              type="default"
              onClick={handleActivateInvitationCode}
              loading={activatingCode}
              disabled={activatingCode || !activationCode.trim()}
            >
              {activatingCode
                ? t('common.activating')
                : t('settings.account.activateInvitationCode')}
            </Button>
          </div>

          {invitationCodes.length > 0 ? (
            <div className="space-y-2">
              {invitationCodes.map((code, index) => (
                <div
                  key={code.code || index}
                  className="p-3 rounded-lg bg-refly-bg-control-z1 border border-refly-border-primary"
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
                    <div className="text-xs text-refly-text-1">
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
