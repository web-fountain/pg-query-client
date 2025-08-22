import type { SVGProps }  from 'react';
import styles             from './styles.module.css';


function Icon({ name, className, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const cn = className ? `${styles['icon']} ${className}` : styles['icon'];

  return (
    <svg className={cn} {...props}>
      <use href={`/sprites/icons.svg#icon-${name}`} />
    </svg>
  );
}


export default Icon;
