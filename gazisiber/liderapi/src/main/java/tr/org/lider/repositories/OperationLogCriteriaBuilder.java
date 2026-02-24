package tr.org.lider.repositories;

import java.util.ArrayList;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import tr.org.lider.dto.OperationLogDTO;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.entities.OperationType;

/*
 * Operation Logs Report Criteria Builder implements filtering multiple data.
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 */

@Service
public class OperationLogCriteriaBuilder {

	@PersistenceContext
	EntityManager entityManager;
	
	public Page<OperationLogImpl> filterLogs(OperationLogDTO operationLogDTO) {
		PageRequest pageable = PageRequest.of(operationLogDTO.getPageNumber() - 1, operationLogDTO.getPageSize());

		CriteriaBuilder criteriaBuilder = entityManager.getCriteriaBuilder();
		CriteriaBuilder criteriaBuilderCount = entityManager.getCriteriaBuilder();
		CriteriaQuery<Long> criteriaCount = criteriaBuilderCount.createQuery(Long.class);
		Root<OperationLogImpl> fromCount = criteriaCount.from(OperationLogImpl.class);
		criteriaCount.select(criteriaBuilderCount.count(fromCount));

		CriteriaQuery<OperationLogImpl> criteriaQuery = criteriaBuilder.createQuery(OperationLogImpl.class);
		Root<OperationLogImpl> from = criteriaQuery.from(OperationLogImpl.class);
		CriteriaQuery<OperationLogImpl> select = criteriaQuery.select(from);

		List<Predicate> predicates = new ArrayList<>();
		//for filtered result count
		List<Predicate> predicatesCount = new ArrayList<>();

		if (operationLogDTO.getStartDate() != null) {
			predicates.add(criteriaBuilder.greaterThanOrEqualTo(from.get("createDate"), operationLogDTO.getStartDate().get()));
			predicatesCount.add(criteriaBuilderCount.greaterThanOrEqualTo(fromCount.get("createDate"), operationLogDTO.getStartDate().get()));
		}
		
		if (operationLogDTO.getEndDate() != null) {
			predicates.add(criteriaBuilder.lessThanOrEqualTo(from.get("createDate"), operationLogDTO.getEndDate().get()));
			predicatesCount.add(criteriaBuilderCount.lessThanOrEqualTo(fromCount.get("createDate"), operationLogDTO.getEndDate().get()));
		}
		
		if(operationLogDTO.getUserId() != null && !operationLogDTO.getUserId().equals("")) {
			predicates.add(criteriaBuilder.like(from.get("userId").as(String.class), "%" + operationLogDTO.getUserId() + "%"));
			predicatesCount.add(criteriaBuilderCount.like(fromCount.get("userId").as(String.class), "%" + operationLogDTO.getUserId() + "%") );
		}
		
		if(operationLogDTO.getRequestIp() != null && !operationLogDTO.getRequestIp().equals("")) {
			predicates.add(criteriaBuilder.like(from.get("requestIp").as(String.class), "%" + operationLogDTO.getRequestIp() + "%"));
			predicatesCount.add(criteriaBuilderCount.like(fromCount.get("requestIp").as(String.class), "%" + operationLogDTO.getRequestIp() + "%") );
		}
		
		if(!operationLogDTO.getOperationType().equals("ALL")) {
			predicates.add(criteriaBuilder.equal(from.get("operationType").as(String.class), operationLogDTO.getOperationType()));
			predicatesCount.add(criteriaBuilderCount.equal(fromCount.get("operationType").as(String.class), OperationType.LOGIN.getId()) );
		}
		
		criteriaQuery.where(predicates.toArray(new Predicate[predicates.size()]));
		criteriaQuery.orderBy(criteriaBuilder.desc(from.get("createDate")));
		Long count = count(criteriaBuilderCount, predicatesCount, criteriaCount);

		TypedQuery<OperationLogImpl> typedQuery = entityManager.createQuery(select);
		typedQuery.setFirstResult((operationLogDTO.getPageNumber() - 1) * operationLogDTO.getPageSize());
		if(operationLogDTO.getPageNumber() * operationLogDTO.getPageSize() > count) {
			typedQuery.setMaxResults((int) (count%operationLogDTO.getPageSize()));
		} else {
			typedQuery.setMaxResults(operationLogDTO.getPageSize());
		}
		
		Page<OperationLogImpl> logs = new PageImpl<OperationLogImpl>(typedQuery.getResultList(), pageable, count);

		return logs;
	}

	/*
	 * get count of filtered data for paging
	 */
	public Long count(CriteriaBuilder builder, List<Predicate> restrictions, CriteriaQuery<Long> criteria ) {
		criteria.where(restrictions.toArray(new Predicate[restrictions.size()]));
		TypedQuery<Long> query = entityManager.createQuery(criteria);
		return query.getSingleResult();
	}
}
