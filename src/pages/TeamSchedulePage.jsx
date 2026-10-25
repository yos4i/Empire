import React from 'react';
import WeeklyScheduleView from '../components/soldier/WeeklyScheduleView';
import { useSoldier } from '../components/soldier/SoldierContext';
import { PageLoader } from '../components/ui/spinner';

export default function TeamSchedulePage() {
  const { mission, myIds, loading } = useSoldier();
  if (loading) return <PageLoader />;
  return <WeeklyScheduleView soldierMission={mission} myIds={myIds} />;
}
