import React from "react";

import { type FinanceIconName } from "./FinanceIcons.js";
import ShortInfoCard from "./ShortInfoCard.js";

type TrendSignalCardProps = {
  icon: FinanceIconName;
  title: string;
  description: string;
};

const TrendSignalCard = ({
  icon,
  title,
  description,
}: TrendSignalCardProps) => (
  <ShortInfoCard
    icon={icon}
    title={title}
    description={description}
    topAccent={true}
  />
);

export default TrendSignalCard;
