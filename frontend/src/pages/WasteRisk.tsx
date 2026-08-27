import React from 'react';
import { ShieldAlert } from 'lucide-react';
import ComingSoon from '../components/ComingSoon';

const WasteRisk: React.FC = () => (
    <ComingSoon
        title="Waste Risk Index"
        description="The Cloud Waste Risk Index (CWRI) quantifies the financial and operational risk of cloud inefficiencies. Composite scoring across spend velocity, utilization drift, and configuration anomalies."
        icon={ShieldAlert}
        eta="Planned for Phase 15"
    />
);

export default WasteRisk;
